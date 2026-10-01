import type { SupabaseClient } from "@supabase/supabase-js";
import type { SleeperLeague } from "./sleeper";
import { scoreProjection } from "./vbd";
import { ensurePlayers, ensureWeekProjections, ensureYtdStats, ensureValues, ensureProjections, fetchAll } from "./ingest";
import { SKILL_POS, rateOf, ifBackRate, type RatedPlayer } from "./roster-needs";

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

  const y = Number(season);
  const [players, weekProj, preProj, ytd, values, seasons, news] = await Promise.all([
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
    fetchAll<{ sleeper_id: string; value: number; age: number | null; trend30: number | null }>((f, t) =>
      db.from("values_fc").select("sleeper_id,value,age,trend30").eq("num_qbs", numQbs).eq("ppr", ppr).range(f, t),
    ),
    fetchAll<{ sleeper_id: string; season: number; games: number | null; fp_ppr: number | null; stats: { rec?: number } | null }>((f, t) =>
      db
        .from("player_seasons")
        .select("sleeper_id,season,games,fp_ppr,stats")
        .gte("season", y - 3)
        .order("season", { ascending: false })
        .range(f, t),
    ).catch(() => []),
    fetchAll<{ player_ids: string[] | null; title: string; published_at: string }>((f, t) =>
      db
        .from("news_cache")
        .select("player_ids,title,published_at")
        .gte("published_at", new Date(Date.now() - 14 * 86400000).toISOString())
        .order("published_at", { ascending: false })
        .range(f, t),
    ).catch(() => []),
  ]);

  // Historical seasons re-scored for this league's reception weight.
  const recW = scoring.rec ?? 0;
  const histById = new Map<string, { season: number; ppg: number; games: number }[]>();
  for (const h of seasons) {
    const games = h.games ?? 0;
    if (!games || h.fp_ppr == null) continue;
    const pts = Number(h.fp_ppr) - (1 - recW) * (h.stats?.rec ?? 0);
    const list = histById.get(h.sleeper_id) ?? [];
    list.push({ season: h.season, ppg: Math.round((pts / games) * 10) / 10, games });
    histById.set(h.sleeper_id, list);
  }
  const newsById = new Map<string, { count: number; headline: string }>();
  for (const n of news) {
    for (const pid of n.player_ids ?? []) {
      const cur = newsById.get(pid);
      newsById.set(pid, { count: (cur?.count ?? 0) + 1, headline: cur?.headline ?? n.title });
    }
  }

  const weekById = new Map(weekProj.map((r) => [r.sleeper_id, r]));
  const preById = new Map(preProj.map((r) => [r.sleeper_id, r.stats]));
  const ytdById = new Map(ytd.map((r) => [r.sleeper_id, r]));
  const valById = new Map(values.map((r) => [r.sleeper_id, r]));

  const byId = new Map<string, RatedPlayer>();
  for (const p of players) {
    const w = weekById.get(p.sleeper_id);
    const pre = preById.get(p.sleeper_id);
    const yt = ytdById.get(p.sleeper_id);
    const hist = histById.get(p.sleeper_id);
    const nw = newsById.get(p.sleeper_id);
    const val = valById.get(p.sleeper_id);
    // Only rate people who matter: rostered, projected/producing free agents,
    // or unsigned veterans with recent production and live signing signals.
    const comeback =
      !p.team && !!hist?.some((h) => h.season >= y - 2 && h.games >= 6) && ((nw?.count ?? 0) > 0 || (val?.trend30 ?? 0) > 0);
    if (!rostered.has(p.sleeper_id) && !w && !yt && !comeback) continue;
    const weekPts = w ? scoreProjection(w.stats, scoring) : null;
    const prePts = pre ? scoreProjection(pre, scoring) : null;
    const preGames = pre?.gp && pre.gp > 0 ? pre.gp : 17;
    const ytdPts = yt ? scoreProjection(yt.stats, scoring) : null;
    const gp = yt?.gp ?? 0;
    const onBye = !!p.team && !!w && !w.opponent;
    byId.set(p.sleeper_id, {
      id: p.sleeper_id,
      name: p.name,
      pos: p.pos,
      team: p.team,
      injury: p.status,
      value: val?.value ?? null,
      age: val?.age ?? null,
      trend30: val?.trend30 ?? null,
      hist,
      ifBack: !p.team || (p.status && ["IR", "PUP", "SUS", "NA"].includes(p.status)) ? ifBackRate(hist) : null,
      newsCount: nw?.count ?? 0,
      headline: nw?.headline ?? null,
      opp: w?.opponent ?? null,
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
