import type { SupabaseClient } from "@supabase/supabase-js";
import type { SleeperLeague } from "./sleeper";
import { scoreProjection } from "./vbd";
import { ensurePlayers, ensureWeekProjections, ensureYtdStats, ensureValues, ensureProjections, fetchAll } from "./ingest";
import { SKILL_POS, rateOf, type RatedPlayer } from "./roster-needs";

/**
 * Rate every rostered skill player (plus projected/producing free agents)
 * under this league's scoring — the shared input to roster needs, trade
 * ideas, and trade evaluation. Upstream refreshes are lazy and fail soft.
 */
export async function loadRatings(
  db: SupabaseClient,
  league: SleeperLeague,
  season: string,
  week: number,
  rostered: Set<string>,
): Promise<{ byId: Map<string, RatedPlayer>; degraded: string[]; asOf: { projections: string | null; stats: string | null } }> {
  const scoring = league.scoring_settings ?? {};
  const numQbs = league.roster_positions.includes("SUPER_FLEX") ? 2 : 1;
  const rec = scoring.rec ?? 0;
  const ppr = rec >= 1 ? 1 : rec >= 0.5 ? 0.5 : 0;
  const degraded: string[] = [];
  const soft = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      degraded.push(name);
    }
  };
  await soft("players", () => ensurePlayers(db));
  await Promise.all([
    soft("projections", () => ensureWeekProjections(db, season, week, false, 60 * 60 * 1000)),
    soft("preseason", () => ensureProjections(db, season)),
    soft("stats", () => ensureYtdStats(db, season)),
    soft("values", () => ensureValues(db, numQbs as 1 | 2, ppr as 0 | 0.5 | 1)),
  ]);

  const [players, weekProj, preProj, ytd, values] = await Promise.all([
    fetchAll<{ sleeper_id: string; name: string; team: string | null; pos: string; status: string | null }>((f, t) =>
      db.from("players").select("sleeper_id,name,team,pos,status").in("pos", [...SKILL_POS]).range(f, t),
    ),
    fetchAll<{ sleeper_id: string; stats: Record<string, number>; opponent: string | null; updated_at: string }>((f, t) =>
      db.from("projections").select("sleeper_id,stats,opponent,updated_at").eq("season", Number(season)).eq("week", week).range(f, t),
    ),
    fetchAll<{ sleeper_id: string; stats: Record<string, number> }>((f, t) =>
      db.from("projections").select("sleeper_id,stats").eq("season", Number(season)).eq("week", 0).range(f, t),
    ),
    fetchAll<{ sleeper_id: string; gp: number; stats: Record<string, number>; updated_at: string }>((f, t) =>
      db.from("player_stats_ytd").select("sleeper_id,gp,stats,updated_at").eq("season", Number(season)).range(f, t),
    ),
    fetchAll<{ sleeper_id: string; value: number; age: number | null }>((f, t) =>
      db.from("values_fc").select("sleeper_id,value,age").eq("num_qbs", numQbs).eq("ppr", ppr).range(f, t),
    ),
  ]);

  const weekById = new Map(weekProj.map((r) => [r.sleeper_id, r]));
  const preById = new Map(preProj.map((r) => [r.sleeper_id, r.stats]));
  const ytdById = new Map(ytd.map((r) => [r.sleeper_id, r]));
  const valById = new Map(values.map((r) => [r.sleeper_id, r]));

  const byId = new Map<string, RatedPlayer>();
  for (const p of players) {
    const w = weekById.get(p.sleeper_id);
    const pre = preById.get(p.sleeper_id);
    const y = ytdById.get(p.sleeper_id);
    // Only rate people who matter: rostered, or projected/producing free agents.
    if (!rostered.has(p.sleeper_id) && !w && !y) continue;
    const weekPts = w ? scoreProjection(w.stats, scoring) : null;
    const prePts = pre ? scoreProjection(pre, scoring) : null;
    const preGames = pre?.gp && pre.gp > 0 ? pre.gp : 17;
    const ytdPts = y ? scoreProjection(y.stats, scoring) : null;
    const gp = y?.gp ?? 0;
    const onBye = !!p.team && !!w && !w.opponent;
    byId.set(p.sleeper_id, {
      id: p.sleeper_id,
      name: p.name,
      pos: p.pos,
      team: p.team,
      injury: p.status,
      value: valById.get(p.sleeper_id)?.value ?? null,
      age: valById.get(p.sleeper_id)?.age ?? null,
      gp,
      ytdPpg: gp > 0 && ytdPts != null ? Math.round((ytdPts / gp) * 10) / 10 : null,
      weekProj: weekPts,
      rate: rateOf({
        ytdPts,
        gp,
        preseasonPpg: prePts != null && prePts > 0 ? prePts / preGames : null,
        weekProj: weekPts,
        injury: p.status,
        onBye,
      }),
    });
  }

  const newest = (rows: { updated_at: string }[]) =>
    rows.reduce<string | null>((m, r) => (!m || r.updated_at > m ? r.updated_at : m), null);
  return { byId, degraded, asOf: { projections: newest(weekProj), stats: newest(ytd) } };
}
