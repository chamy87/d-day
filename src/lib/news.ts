import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lightweight RSS aggregation for the dashboard news tab. No XML dependency —
 * feeds are simple enough for a forgiving regex parse. Fragile by design:
 * every feed is fail-soft and results cache into news_cache best-effort.
 */

const FEEDS: { source: string; url: string }[] = [
  { source: "ESPN", url: "https://www.espn.com/espn/rss/nfl/news" },
  { source: "CBS", url: "https://www.cbssports.com/rss/headlines/nfl/" },
];

export type NewsItem = {
  id: string;
  source: string;
  title: string;
  url: string | null;
  publishedAt: string | null;
};

function pull(tag: string, xml: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

async function fetchFeed(source: string, url: string): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: { "user-agent": "d-day-fantasy/1.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`${source} feed → ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item) => {
    const title = pull("title", item);
    if (!title) return [];
    const link = pull("link", item);
    const pub = pull("pubDate", item);
    return [
      {
        id: `${source}:${(pull("guid", item) ?? link ?? title).slice(0, 180)}`,
        source,
        title,
        url: link,
        publishedAt: pub ? new Date(pub).toISOString() : null,
      },
    ];
  });
}

/**
 * Cron ingestion: fetch all feeds and store items in news_cache with
 * player_ids tagged by full-name match against the players table. This is
 * the corpus the AI advisor reads (news_cache.player_ids has a GIN index).
 */
export async function ingestNews(db: SupabaseClient): Promise<{ stored: number; tagged: number }> {
  const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f.source, f.url)));
  const all: NewsItem[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);
  if (!all.length) throw new Error("all news feeds failed");

  const players: { sleeper_id: string; name: string }[] = [];
  for (let page = 0; ; page++) {
    const { data } = await db
      .from("players")
      .select("sleeper_id,name")
      .range(page * 1000, page * 1000 + 999);
    if (!data?.length) break;
    players.push(...data);
    if (data.length < 1000) break;
  }

  let tagged = 0;
  const rows = all.map((i) => {
    const t = i.title.toLowerCase();
    const ids = players.filter((p) => p.name.length > 5 && t.includes(p.name.toLowerCase())).map((p) => p.sleeper_id);
    if (ids.length) tagged++;
    return {
      id: i.id,
      source: i.source,
      title: i.title,
      url: i.url,
      player_ids: ids,
      published_at: i.publishedAt,
    };
  });
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from("news_cache").upsert(rows.slice(i, i + 200), { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  return { stored: rows.length, tagged };
}

/** Fetch all feeds (fail-soft per feed), filter to relevant player names. */
export async function relevantNews(
  db: SupabaseClient,
  playerNames: string[],
  limit = 12,
): Promise<{ items: NewsItem[]; degraded: boolean }> {
  const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f.source, f.url)));
  const all: NewsItem[] = [];
  let degraded = false;
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else degraded = true;
  }

  // Match on full name or unambiguous "F. Lastname" surname mention.
  const needles = playerNames.map((n) => n.toLowerCase()).filter((n) => n.length > 4);
  const matched = all.filter((item) => {
    const t = item.title.toLowerCase();
    return needles.some((n) => t.includes(n) || t.includes(n.split(" ").slice(-1)[0] + " "));
  });
  const items = (matched.length ? matched : all)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, limit);

  // Best-effort cache for future filtering work.
  try {
    if (all.length) {
      await db.from("news_cache").upsert(
        all.slice(0, 100).map((i) => ({
          id: i.id,
          source: i.source,
          title: i.title,
          url: i.url,
          player_ids: [],
          published_at: i.publishedAt,
        })),
        { onConflict: "id" },
      );
    }
  } catch {
    // cache only
  }

  return { items, degraded };
}
