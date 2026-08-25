import type { SupabaseClient } from "@supabase/supabase-js";
import { sleeper, injuryTag } from "./sleeper";

/**
 * Data ingestion for the draft board. Each source refreshes only when stale
 * (self-healing: the board API calls ensure* lazily, /api/cron/daily forces
 * them). Fragile sources fail soft and report a degraded flag instead of
 * breaking the board (honest degradation).
 */

const FANTASY_POS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
const STALE_MS = 20 * 60 * 60 * 1000; // 20h — daily cron plus slack

async function newestUpdate(
  db: SupabaseClient,
  table: string,
  eq?: Record<string, string | number>,
): Promise<number | null> {
  let q = db.from(table).select("updated_at").order("updated_at", { ascending: false }).limit(1);
  for (const [k, v] of Object.entries(eq ?? {})) q = q.eq(k, v);
  const { data } = await q;
  const ts = (data?.[0] as { updated_at?: string } | undefined)?.updated_at;
  return ts ? new Date(ts).getTime() : null;
}

function isFresh(ts: number | null): boolean {
  return ts != null && Date.now() - ts < STALE_MS;
}

async function chunkedUpsert(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

/** Read a whole table region past PostgREST's 1000-row page cap. */
export async function fetchAll<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await buildQuery(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** Sleeper players map → players table (daily; ~5 MB source). */
export async function ensurePlayers(db: SupabaseClient, force = false): Promise<boolean> {
  if (!force && isFresh(await newestUpdate(db, "players"))) return false;
  const map = await sleeper.playersMap();
  const now = new Date().toISOString();
  const rows = Object.values(map)
    .filter((p) => p.position && FANTASY_POS.has(p.position) && (p.active || p.position === "DEF"))
    .map((p) => ({
      sleeper_id: p.player_id,
      name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.player_id,
      team: p.team,
      pos: p.position,
      status: injuryTag(p.injury_status),
      meta: {},
      updated_at: now,
    }));
  await chunkedUpsert(db, "players", rows, "sleeper_id");
  return true;
}

/** Sleeper season projections (fragile) → projections table, week 0. */
export async function ensureProjections(
  db: SupabaseClient,
  season: string,
  force = false,
): Promise<boolean> {
  const fresh = await newestUpdate(db, "projections", { season: Number(season), week: 0 });
  if (!force && isFresh(fresh)) return false;
  const rows = (await sleeper.seasonProjections(season))
    .filter((p) => p.stats && Object.keys(p.stats).length > 0)
    .map((p) => ({
      season: Number(season),
      week: 0,
      sleeper_id: p.player_id,
      stats: p.stats,
      updated_at: new Date().toISOString(),
    }));
  if (!rows.length) throw new Error("projections source returned no rows");
  await chunkedUpsert(db, "projections", rows, "season,week,sleeper_id");
  return true;
}

/** Sleeper weekly projections (fragile) → projections table, week N. */
export async function ensureWeekProjections(
  db: SupabaseClient,
  season: string,
  week: number,
  force = false,
): Promise<boolean> {
  const fresh = await newestUpdate(db, "projections", { season: Number(season), week });
  if (!force && isFresh(fresh)) return false;
  const rows = (await sleeper.weekProjections(season, week))
    .filter((p) => p.stats && Object.keys(p.stats).length > 0)
    .map((p) => ({
      season: Number(season),
      week,
      sleeper_id: p.player_id,
      stats: p.stats,
      updated_at: new Date().toISOString(),
    }));
  if (!rows.length) throw new Error("weekly projections source returned no rows");
  await chunkedUpsert(db, "projections", rows, "season,week,sleeper_id");
  return true;
}

/** Minimal quote-aware CSV line parser (nflverse files are simple). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const HISTORY_POS = new Set(["QB", "RB", "WR", "TE"]);

/**
 * nflverse/nflfastR historical season stats → player_seasons. Static data:
 * a season already present is skipped unless forced. Matched to Sleeper ids
 * by normalized name + position.
 */
export async function ensurePlayerSeasons(
  db: SupabaseClient,
  seasons: number[],
  force = false,
): Promise<Record<number, string>> {
  const summary: Record<number, string> = {};
  const players = await fetchAll<{ sleeper_id: string; name: string; pos: string }>((from, to) =>
    db.from("players").select("sleeper_id,name,pos").range(from, to),
  );
  const byKey = new Map(players.map((p) => [`${normalizeName(p.name)}:${p.pos}`, p.sleeper_id]));

  for (const season of seasons) {
    if (!force) {
      const { count } = await db
        .from("player_seasons")
        .select("season", { count: "exact", head: true })
        .eq("season", season);
      if ((count ?? 0) > 100) {
        summary[season] = "present";
        continue;
      }
    }
    // nflverse moved newer seasons to the stats_player release; try both.
    const urls = [
      `https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_season_${season}.csv`,
      `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_${season}.csv`,
    ];
    let text: string | null = null;
    let lastStatus = 0;
    for (const url of urls) {
      const res = await fetch(url, { next: { revalidate: 0 } });
      lastStatus = res.status;
      if (res.ok) {
        text = await res.text();
        break;
      }
    }
    if (text == null) {
      summary[season] = `error: ${lastStatus}`;
      continue;
    }
    const lines = text.split("\n").filter((l) => l.trim());
    const header = parseCsvLine(lines[0]);
    const col = (name: string) => header.indexOf(name);
    const idx = {
      type: col("season_type"),
      name: col("player_display_name"),
      pos: col("position"),
      team: col("recent_team"),
      games: col("games"),
      fpPpr: col("fantasy_points_ppr"),
      carries: col("carries"),
      rushYd: col("rushing_yards"),
      rushTd: col("rushing_tds"),
      targets: col("targets"),
      rec: col("receptions"),
      recYd: col("receiving_yards"),
      recTd: col("receiving_tds"),
      passYd: col("passing_yards"),
      passTd: col("passing_tds"),
      tgtShare: col("target_share"),
    };
    const now = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    for (const line of lines.slice(1)) {
      const f = parseCsvLine(line);
      if (idx.type >= 0 && f[idx.type] !== "REG") continue;
      const pos = f[idx.pos];
      if (!HISTORY_POS.has(pos)) continue;
      const sleeperId = byKey.get(`${normalizeName(f[idx.name])}:${pos}`);
      if (!sleeperId) continue;
      const games = Number(f[idx.games]) || 0;
      const fpPpr = Math.round((Number(f[idx.fpPpr]) || 0) * 10) / 10;
      rows.push({
        season,
        sleeper_id: sleeperId,
        name: f[idx.name],
        pos,
        team: f[idx.team] || null,
        games,
        fp_ppr: fpPpr,
        ppg: games ? Math.round((fpPpr / games) * 10) / 10 : 0,
        stats: {
          carries: Number(f[idx.carries]) || 0,
          rush_yd: Number(f[idx.rushYd]) || 0,
          rush_td: Number(f[idx.rushTd]) || 0,
          targets: Number(f[idx.targets]) || 0,
          rec: Number(f[idx.rec]) || 0,
          rec_yd: Number(f[idx.recYd]) || 0,
          rec_td: Number(f[idx.recTd]) || 0,
          pass_yd: Number(f[idx.passYd]) || 0,
          pass_td: Number(f[idx.passTd]) || 0,
          target_share: Math.round((Number(f[idx.tgtShare]) || 0) * 1000) / 1000,
        },
        updated_at: now,
      });
    }
    if (!rows.length) {
      summary[season] = "error: no matched rows";
      continue;
    }
    await chunkedUpsert(db, "player_seasons", rows, "season,sleeper_id");
    summary[season] = `ingested ${rows.length}`;
  }
  return summary;
}

/** Boris Chen tier scoring buckets and their S3 file suffixes. */
const BC_SUFFIX: Record<string, string> = { std: "", ppr: "-PPR", half: "-HALF" };
const BC_BASE = "https://s3-us-west-1.amazonaws.com/fftiers/out";

/** Boris Chen tiers → tiers table (QB/K/DST are scoring-independent). */
export async function ensureTiers(db: SupabaseClient, scoring: "std" | "ppr" | "half", force = false): Promise<boolean> {
  const fresh = await newestUpdate(db, "tiers", { scoring });
  if (!force && isFresh(fresh)) return false;

  const files: { pos: string; file: string }[] = [
    { pos: "QB", file: "text_QB" },
    { pos: "K", file: "text_K" },
    { pos: "DEF", file: "text_DST" },
    { pos: "RB", file: `text_RB${BC_SUFFIX[scoring]}` },
    { pos: "WR", file: `text_WR${BC_SUFFIX[scoring]}` },
    { pos: "TE", file: `text_TE${BC_SUFFIX[scoring]}` },
  ];

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const { pos, file } of files) {
    const res = await fetch(`${BC_BASE}/${file}.txt`, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`Boris Chen ${file} → ${res.status}`);
    const text = await res.text();
    let rank = 0;
    for (const line of text.split("\n")) {
      const m = line.match(/^Tier (\d+):\s*(.+)$/);
      if (!m) continue;
      const tier = Number(m[1]);
      for (const name of m[2].split(",").map((s) => s.trim()).filter(Boolean)) {
        rank += 1;
        rows.push({ pos, scoring, tier, rank, player_name: name, updated_at: now });
      }
    }
    // stale tail ranks from a longer previous list would linger past upsert
    await db.from("tiers").delete().eq("pos", pos).eq("scoring", scoring).gt("rank", rank);
  }
  if (!rows.length) throw new Error("Boris Chen returned no tiers");
  await chunkedUpsert(db, "tiers", rows, "pos,scoring,rank");
  return true;
}

/** FantasyCalc redraft values → values_fc table, keyed by league shape. */
export async function ensureValues(db: SupabaseClient, numQbs: 1 | 2, ppr: 0 | 0.5 | 1, force = false): Promise<boolean> {
  const fresh = await newestUpdate(db, "values_fc", { num_qbs: numQbs, ppr });
  if (!force && isFresh(fresh)) return false;
  const res = await fetch(
    `https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=${numQbs}&numTeams=12&ppr=${ppr}`,
    { next: { revalidate: 0 } },
  );
  if (!res.ok) throw new Error(`FantasyCalc → ${res.status}`);
  const data = (await res.json()) as {
    player: { sleeperId: string | null; maybeAge: number | null };
    value: number;
    trend30Day: number | null;
    overallRank: number | null;
    positionRank: number | null;
  }[];
  const now = new Date().toISOString();
  const rows = data
    .filter((d) => d.player?.sleeperId)
    .map((d) => ({
      sleeper_id: d.player.sleeperId,
      num_qbs: numQbs,
      ppr,
      value: d.value,
      trend30: d.trend30Day,
      overall_rank: d.overallRank,
      pos_rank: d.positionRank,
      age: d.player.maybeAge,
      updated_at: now,
    }));
  if (!rows.length) throw new Error("FantasyCalc returned no matched players");
  await chunkedUpsert(db, "values_fc", rows, "sleeper_id,num_qbs,ppr");
  return true;
}

/** Boris Chen scoring bucket for a league's rec setting. */
export function bcScoring(rec: number | undefined): "std" | "ppr" | "half" {
  if ((rec ?? 0) >= 1) return "ppr";
  if ((rec ?? 0) >= 0.5) return "half";
  return "std";
}

type FfcPlayer = {
  name: string;
  position: string;
  team: string | null;
  adp: number;
  stdev: number | null;
  bye: number | null;
};

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
}

/** FantasyFootballCalculator ADP → adp table, keyed (format, teams). */
export async function ensureAdp(
  db: SupabaseClient,
  format: string,
  teams: number,
  season: string,
  force = false,
): Promise<boolean> {
  const fresh = await newestUpdate(db, "adp", { format, teams });
  if (!force && isFresh(fresh)) return false;

  const res = await fetch(
    `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${teams}&year=${season}&position=all`,
    { next: { revalidate: 0 } },
  );
  if (!res.ok) throw new Error(`FFC adp → ${res.status}`);
  const ffc = ((await res.json()) as { players: FfcPlayer[] }).players ?? [];
  if (!ffc.length) throw new Error("FFC returned no players");

  // Name-match FFC players to the Sleeper id space.
  const players = await fetchAll<{ sleeper_id: string; name: string; pos: string }>((from, to) =>
    db.from("players").select("sleeper_id,name,pos").range(from, to),
  );
  const byKey = new Map(players.map((p) => [`${normalizeName(p.name)}:${p.pos}`, p.sleeper_id]));

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  const byeUpdates: { sleeper_id: string; bye: number }[] = [];
  for (const p of ffc) {
    const key = `${normalizeName(p.name)}:${p.position === "PK" ? "K" : p.position}`;
    const sleeperId = byKey.get(key);
    if (!sleeperId) continue; // unmatched (mostly DEF naming) — skip
    rows.push({
      format,
      teams,
      sleeper_id: sleeperId,
      adp: p.adp,
      stdev: p.stdev,
      updated_at: now,
    });
    if (p.bye) byeUpdates.push({ sleeper_id: sleeperId, bye: p.bye });
  }
  await chunkedUpsert(db, "adp", rows, "format,teams,sleeper_id");
  // Byes ride along with FFC data; players map doesn't carry them.
  for (let i = 0; i < byeUpdates.length; i += 500) {
    await db
      .from("players")
      .upsert(
        byeUpdates.slice(i, i + 500).map((u) => ({ ...u, updated_at: now })),
        { onConflict: "sleeper_id", ignoreDuplicates: false },
      );
  }
  return true;
}
