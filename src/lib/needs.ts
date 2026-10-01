import type { SupabaseClient } from "@supabase/supabase-js";
import { sleeper, reserveRules, type SleeperLeague, type SleeperRoster, type SleeperUser } from "./sleeper";
import { loadRatings } from "./ratings";
import { irMoves, type IrMove } from "./lineup";
import {
  positionStrength,
  waiverIdeas,
  tradeIdeas,
  stashIdeas,
  type RatedPlayer,
  type PositionStrength,
  type WaiverIdea,
  type TradeIdea,
  type StashIdea,
  type TeamInput,
} from "./roster-needs";

export type NeedsResponse = {
  week: number;
  weeksLeft: number;
  faab: { remaining: number; budget: number } | null;
  strength: PositionStrength[];
  waivers: WaiverIdea[];
  trades: TradeIdea[];
  stash: StashIdea[];
  /** IR-slot housekeeping (activate / move to IR / IR full). */
  ir: IrMove[];
  irSlots: { used: number; total: number };
  players: Record<string, RatedPlayer>;
  /** When the inputs were last refreshed upstream. */
  asOf: { projections: string | null; stats: string | null };
  degraded: string[];
};

export type NeedsContext = {
  league: SleeperLeague;
  rosters: SleeperRoster[];
  users: SleeperUser[];
  mine: SleeperRoster;
  teams: TeamInput[];
  byId: Map<string, RatedPlayer>;
};

/**
 * Objective roster needs for one team: positional strength vs the league,
 * free agents ranked by lineup gain (with FAAB math), comeback stashes,
 * IR-slot moves, and two-sided trade ideas priced in market value.
 * Deterministic — see src/lib/roster-needs.ts.
 */
export async function computeNeeds(
  db: SupabaseClient,
  leagueId: string,
  rosterId: number,
): Promise<{ data: NeedsResponse; ctx: NeedsContext } | { error: string; status: number }> {
  const [league, rosters, users, state, trendingRaw] = await Promise.all([
    sleeper.league(leagueId).catch(() => null),
    sleeper.leagueRosters(leagueId).catch(() => []),
    sleeper.leagueUsers(leagueId).catch(() => []),
    sleeper.state(),
    sleeper.trendingAdds().catch(() => []),
  ]);
  if (!league) return { error: "League not found.", status: 404 };
  const mine = rosters.find((r) => r.roster_id === rosterId);
  if (!mine) return { error: "Roster not found.", status: 404 };

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
  const reserve = mine.reserve ?? [];

  const unrostered = Array.from(byId.values()).filter((p) => !rostered.has(p.id));
  const freeAgents = unrostered.filter((p) => p.team && (p.rate >= 4 || (p.weekProj ?? 0) >= 5));
  const myTeam = teams.find((t) => t.rosterId === rosterId)!;

  const stash = stashIdeas({
    rosterPositions: league.roster_positions,
    mine: myTeam.players,
    reserve,
    freeAgents: unrostered,
    byId,
    weeksLeft,
    faabRemaining: faab?.remaining ?? null,
  });
  const waivers = waiverIdeas({
    rosterPositions: league.roster_positions,
    mine: myTeam.players,
    reserve,
    freeAgents,
    byId,
    needs,
    weeksLeft,
    faabRemaining: faab?.remaining ?? null,
    trending: new Map(trendingRaw.map((t) => [t.player_id, t.count])),
    holds: new Set(stash.filter((s) => s.kind === "HOLD").map((s) => s.id)),
  });
  const trades = tradeIdeas({
    rosterPositions: league.roster_positions,
    teams,
    myRosterId: rosterId,
    byId,
    strength: strengthByTeam,
  });
  const rules = reserveRules(league);
  const ir = irMoves(mine.players ?? [], reserve, (id) => byId.get(id)?.injury, rules);

  const referenced = new Set<string>([
    ...myTeam.players,
    ...waivers.flatMap((w) => [w.id, w.drop ?? ""]),
    ...trades.flatMap((t) => [t.target, ...t.send]),
    ...stash.map((s) => s.id),
  ]);
  const players: Record<string, RatedPlayer> = {};
  for (const pid of referenced) {
    const p = byId.get(pid);
    if (p) players[pid] = p;
  }

  return {
    data: {
      week,
      weeksLeft,
      faab,
      strength,
      waivers,
      trades,
      stash,
      ir,
      irSlots: { used: reserve.length, total: rules.slots },
      players,
      asOf,
      degraded,
    },
    ctx: { league, rosters, users, mine, teams, byId },
  };
}
