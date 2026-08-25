import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sleeper, scoringLabel } from "@/lib/sleeper";
import { scoreProjection } from "@/lib/vbd";
import { ensurePlayers, ensureWeekProjections } from "@/lib/ingest";
import { relevantNews, type NewsItem } from "@/lib/news";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export type DashboardPlayer = {
  id: string;
  name: string;
  team: string | null;
  pos: string;
  injury: string | null;
  bye: number | null;
  proj: number | null;
};

export type DashboardResponse = {
  league: { leagueId: string; name: string; season: string; status: string; scoring: string; rosterPositions: string[]; draftId: string | null };
  week: number;
  currentWeek: number;
  users: { userId: string; name: string; teamName: string | null }[];
  rosters: { rosterId: number; ownerId: string | null; starters: string[]; players: string[] }[];
  matchups: { matchupId: number | null; rosterId: number; points: number }[];
  playersById: Record<string, DashboardPlayer>;
  waivers: { id: string; adds24h: number; faab: number }[];
  news: NewsItem[];
  degraded: string[];
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{10,20}$/.test(id)) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }

  const [league, users, rosters, state] = await Promise.all([
    sleeper.league(id).catch(() => null),
    sleeper.leagueUsers(id).catch(() => []),
    sleeper.leagueRosters(id).catch(() => []),
    sleeper.state(),
  ]);
  if (!league) return NextResponse.json({ error: "League not found on Sleeper." }, { status: 404 });

  const currentWeek = Math.min(18, Math.max(1, state.week || 1));
  const weekParam = Number(new URL(req.url).searchParams.get("week"));
  const week = weekParam >= 1 && weekParam <= 18 ? weekParam : currentWeek;

  const db = supabaseAdmin();
  const degraded: string[] = [];
  try {
    await ensurePlayers(db);
  } catch {
    degraded.push("players");
  }
  try {
    await ensureWeekProjections(db, state.season, week);
  } catch {
    degraded.push("projections");
  }

  const [matchups, trending] = await Promise.all([
    sleeper.matchups(id, week).catch(() => {
      degraded.push("matchups");
      return [];
    }),
    sleeper.trendingAdds().catch(() => {
      degraded.push("trending");
      return [];
    }),
  ]);

  const rostered = new Set<string>();
  for (const r of rosters) (r.players ?? []).forEach((p) => rostered.add(p));
  const relevant = new Set<string>(rostered);
  trending.forEach((t) => relevant.add(t.player_id));

  const ids = Array.from(relevant);
  const playerRows: { sleeper_id: string; name: string; team: string | null; pos: string; bye: number | null; status: string | null }[] = [];
  const projRows: { sleeper_id: string; stats: Record<string, number> }[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const [{ data: p }, { data: pr }] = await Promise.all([
      db.from("players").select("sleeper_id,name,team,pos,bye,status").in("sleeper_id", chunk),
      db
        .from("projections")
        .select("sleeper_id,stats")
        .eq("season", Number(state.season))
        .eq("week", week)
        .in("sleeper_id", chunk),
    ]);
    playerRows.push(...(p ?? []));
    projRows.push(...(pr ?? []));
  }
  const projById = new Map(projRows.map((r) => [r.sleeper_id, r.stats]));

  const playersById: Record<string, DashboardPlayer> = {};
  for (const p of playerRows) {
    const stats = projById.get(p.sleeper_id);
    playersById[p.sleeper_id] = {
      id: p.sleeper_id,
      name: p.name,
      team: p.team,
      pos: p.pos,
      injury: p.status,
      bye: p.bye,
      proj: stats ? scoreProjection(stats, league.scoring_settings ?? {}) : null,
    };
  }

  const waivers = trending
    .filter((t) => !rostered.has(t.player_id) && playersById[t.player_id])
    .map((t) => {
      const proj = playersById[t.player_id].proj ?? 0;
      return {
        id: t.player_id,
        adds24h: t.count,
        faab: Math.max(1, Math.min(40, Math.round(proj * 1.2))),
      };
    })
    .sort((a, b) => (playersById[b.id].proj ?? 0) - (playersById[a.id].proj ?? 0))
    .slice(0, 12);

  const rosteredNames = playerRows.filter((p) => rostered.has(p.sleeper_id)).map((p) => p.name);
  const { items: news, degraded: newsDegraded } = await relevantNews(db, rosteredNames);
  if (newsDegraded) degraded.push("news");

  return NextResponse.json({
    league: {
      leagueId: league.league_id,
      name: league.name,
      season: league.season,
      status: league.status,
      scoring: scoringLabel(league.scoring_settings?.rec),
      rosterPositions: league.roster_positions,
      draftId: league.draft_id,
    },
    week,
    currentWeek,
    users: users.map((u) => ({ userId: u.user_id, name: u.display_name, teamName: u.metadata?.team_name ?? null })),
    rosters: rosters.map((r) => ({
      rosterId: r.roster_id,
      ownerId: r.owner_id,
      starters: r.starters ?? [],
      players: r.players ?? [],
    })),
    matchups: matchups.map((m) => ({ matchupId: m.matchup_id, rosterId: m.roster_id, points: m.points ?? 0 })),
    playersById,
    waivers,
    news,
    degraded,
  } satisfies DashboardResponse);
}
