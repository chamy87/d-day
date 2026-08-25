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

type FfcPlayer = {
  name: string;
  position: string;
  team: string | null;
  adp: number;
  stdev: number | null;
  bye: number | null;
};

function normalizeName(name: string): string {
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
