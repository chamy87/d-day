import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sleeper } from "@/lib/sleeper";
import { loadRatings } from "@/lib/ratings";
import {
  positionStrength,
  waiverIdeas,
  tradeIdeas,
  type RatedPlayer,
  type PositionStrength,
  type WaiverIdea,
  type TradeIdea,
  type TeamInput,
} from "@/lib/roster-needs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type NeedsResponse = {
  week: number;
  weeksLeft: number;
  faab: { remaining: number; budget: number } | null;
  strength: PositionStrength[];
  waivers: WaiverIdea[];
  trades: TradeIdea[];
  players: Record<string, RatedPlayer>;
  /** When the inputs were last refreshed upstream. */
  asOf: { projections: string | null; stats: string | null };
  degraded: string[];
};

/**
 * Objective roster needs for one team: positional strength vs the league,
 * free agents ranked by lineup gain (with FAAB math), and two-sided trade
 * ideas priced in market value. Deterministic — see src/lib/roster-needs.ts.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rosterId = Number(new URL(req.url).searchParams.get("roster"));
  if (!/^\d{10,20}$/.test(id) || !(rosterId >= 1)) {
    return NextResponse.json({ error: "league and roster are required." }, { status: 400 });
  }

  const [league, rosters, users, state, trendingRaw] = await Promise.all([
    sleeper.league(id).catch(() => null),
    sleeper.leagueRosters(id).catch(() => []),
    sleeper.leagueUsers(id).catch(() => []),
    sleeper.state(),
    sleeper.trendingAdds().catch(() => []),
  ]);
  if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });
  const mine = rosters.find((r) => r.roster_id === rosterId);
  if (!mine) return NextResponse.json({ error: "Roster not found." }, { status: 404 });

  const db = supabaseAdmin();
  const season = state.season;
  const week = Math.min(18, Math.max(1, state.week || 1));
  const rostered = new Set(rosters.flatMap((r) => r.players ?? []));

  const { byId, degraded, asOf } = await loadRatings(db, league, season, week, rostered);

  const teamName = (ownerId: string | null, rid: number) => {
    const u = users.find((x) => x.user_id === ownerId);
    return u?.metadata?.team_name ?? u?.display_name ?? `Team ${rid}`;
  };
  const teams: TeamInput[] = rosters.map((r) => ({
    rosterId: r.roster_id,
    name: teamName(r.owner_id, r.roster_id),
    players: (r.players ?? []).filter((pid) => byId.has(pid)),
  }));

  const strengthByTeam = new Map<number, PositionStrength[]>();
  for (const t of teams) strengthByTeam.set(t.rosterId, positionStrength(league.roster_positions, teams, t.rosterId, byId));
  const strength = strengthByTeam.get(rosterId) ?? [];
  const needs = new Set(strength.filter((s) => s.label === "NEED").map((s) => s.pos));

  const faabOn = league.settings?.waiver_type === 2;
  const budget = league.settings?.waiver_budget ?? 100;
  const faab = faabOn ? { budget, remaining: Math.max(0, budget - (mine.settings?.waiver_budget_used ?? 0)) } : null;
  const weeksLeft = Math.max(1, 17 - week + 1);

  const freeAgents = Array.from(byId.values()).filter(
    (p) => !rostered.has(p.id) && p.team && (p.rate >= 4 || (p.weekProj ?? 0) >= 5),
  );
  const myTeam = teams.find((t) => t.rosterId === rosterId)!;
  const waivers = waiverIdeas({
    rosterPositions: league.roster_positions,
    mine: myTeam.players,
    reserve: mine.reserve ?? [],
    freeAgents,
    byId,
    needs,
    weeksLeft,
    faabRemaining: faab?.remaining ?? null,
    trending: new Map(trendingRaw.map((t) => [t.player_id, t.count])),
  });
  const trades = tradeIdeas({
    rosterPositions: league.roster_positions,
    teams,
    myRosterId: rosterId,
    byId,
    strength: strengthByTeam,
  });

  const referenced = new Set<string>([
    ...myTeam.players,
    ...waivers.flatMap((w) => [w.id, w.drop ?? ""]),
    ...trades.flatMap((t) => [t.target, ...t.send]),
  ]);
  const out: Record<string, RatedPlayer> = {};
  for (const pid of referenced) {
    const p = byId.get(pid);
    if (p) out[pid] = p;
  }

  return NextResponse.json({
    week,
    weeksLeft,
    faab,
    strength,
    waivers,
    trades,
    players: out,
    asOf,
    degraded,
  } satisfies NeedsResponse);
}
