/**
 * Objective roster-needs, waiver, and trade math. Every number traces to
 * data: scoring rates (league scoring), lineup simulations, and FantasyCalc
 * market values. No AI here — the AI only writes the pitch afterwards.
 *
 *   rate      = points/game we expect going forward:
 *               shrunk = (season pts + 4 × preseason ppg) / (games + 4)
 *               rate   = ½ shrunk + ½ this week's projection (when healthy & playing)
 *   strength  = your top-N rates at a position vs the league-average top-N
 *   gain/wk   = Δ of your optimal lineup's total rate (exact optimizer)
 *   price     = FantasyCalc value; 2-for-1 packages count the 2nd piece at 60%
 */

import { optimizeLineup, startingSlots, SLOT_ELIGIBLE } from "./lineup";

export const SKILL_POS = ["QB", "RB", "WR", "TE"] as const;
const LONG_TERM = new Set(["IR", "PUP", "SUS", "NA"]);
const PRIOR_GAMES = 4;
/** Consolidation discount: the receiver of 2-for-1 must cut a player. */
const SECOND_PIECE = 0.6;

export type RatedPlayer = {
  id: string;
  name: string;
  pos: string;
  team: string | null;
  injury: string | null;
  value: number | null;
  age: number | null;
  gp: number;
  ytdPpg: number | null;
  weekProj: number | null;
  rate: number;
  /** This week's opponent (null with a team = bye). */
  opp?: string | null;
  /** nflverse seasons in league scoring, newest first. */
  hist?: { season: number; ppg: number; games: number }[];
  /** Expected pts/g if an unsigned or long-term-injured player gets back on the field. */
  ifBack?: number | null;
  /** Tagged headlines in the last 14 days (signing / return chatter is the signal). */
  newsCount?: number;
  headline?: string | null;
  /** FantasyCalc 30-day value change — the market pricing in news. */
  trend30?: number | null;
};

export function rateOf(input: {
  ytdPts: number | null;
  gp: number;
  preseasonPpg: number | null;
  weekProj: number | null;
  injury: string | null;
  onBye: boolean;
}): number {
  const { ytdPts, gp, preseasonPpg, weekProj, injury, onBye } = input;
  let shrunk: number | null = null;
  if (preseasonPpg != null) shrunk = ((ytdPts ?? 0) + PRIOR_GAMES * preseasonPpg) / (gp + PRIOR_GAMES);
  else if (gp > 0 && ytdPts != null) shrunk = ytdPts / gp;
  const weekUsable = weekProj != null && weekProj > 0 && !injury && !onBye;
  let rate = shrunk ?? (weekUsable ? weekProj! : 0);
  if (shrunk != null && weekUsable) rate = 0.5 * shrunk + 0.5 * weekProj!;
  return Math.round(rate * 10) / 10;
}

/** Available going forward (one-week OUT still counts; IR/PUP/SUS and unsigned players don't). */
export const availableRate = (p: RatedPlayer) => (!p.team || (p.injury && LONG_TERM.has(p.injury)) ? 0 : p.rate);

/** Comeback haircut: rust, age, new offense. */
const IF_BACK_FACTOR = 0.8;

/**
 * Expected rate if a sidelined/unsigned player returns: 80% of the average of
 * his two most recent seasons with 6+ games (league scoring).
 */
export function ifBackRate(hist: { season: number; ppg: number; games: number }[] | undefined): number | null {
  const q = (hist ?? []).filter((h) => h.games >= 6).slice(0, 2);
  if (!q.length) return null;
  return Math.round(IF_BACK_FACTOR * (q.reduce((s, h) => s + h.ppg, 0) / q.length) * 10) / 10;
}

export const isSidelined = (p: RatedPlayer) => !p.team || (!!p.injury && LONG_TERM.has(p.injury));

export type TeamInput = { rosterId: number; name: string; players: string[] };

export type PositionStrength = {
  pos: string;
  slots: number;
  /** Your top-N rates at the position (pts/game). */
  mine: number;
  leagueAvg: number;
  gap: number;
  rank: number;
  teams: number;
  label: "NEED" | "OK" | "STRENGTH";
  starters: { id: string; rate: number }[];
  /** Benched players here who'd be an average starter in this league. */
  surplus: { id: string; rate: number }[];
};

function skillSlots(rosterPositions: string[]) {
  return startingSlots(rosterPositions).filter((s) => SLOT_ELIGIBLE[s] && s !== "K" && s !== "DEF");
}

export function lineupRate(
  rosterPositions: string[],
  ids: string[],
  byId: Map<string, RatedPlayer>,
): number {
  const slots = skillSlots(rosterPositions);
  const players = ids.filter((id) => byId.has(id)).map((id) => ({ id, pos: byId.get(id)!.pos }));
  return optimizeLineup(slots, players, (id) => availableRate(byId.get(id)!)).total;
}

export function positionStrength(
  rosterPositions: string[],
  teams: TeamInput[],
  myRosterId: number,
  byId: Map<string, RatedPlayer>,
): PositionStrength[] {
  const slots = skillSlots(rosterPositions);
  const me = teams.find((t) => t.rosterId === myRosterId);
  if (!me) return [];
  const myLineup = new Set(
    optimizeLineup(
      slots,
      me.players.filter((id) => byId.has(id)).map((id) => ({ id, pos: byId.get(id)!.pos })),
      (id) => availableRate(byId.get(id)!),
    ).fills.map((f) => f.playerId),
  );

  return SKILL_POS.filter((pos) => slots.includes(pos)).map((pos) => {
    const n = slots.filter((s) => s === pos).length;
    const sortedFor = (t: TeamInput) =>
      t.players
        .map((id) => byId.get(id))
        .filter((p): p is RatedPlayer => !!p && p.pos === pos)
        .map((p) => ({ id: p.id, rate: availableRate(p) }))
        .sort((a, b) => b.rate - a.rate);
    const sums = teams.map((t) => ({
      rosterId: t.rosterId,
      sum: sortedFor(t).slice(0, n).reduce((s, x) => s + x.rate, 0),
    }));
    // League-average rate of the k-th starter, so "average starter" means something.
    const kthAvg = Array.from({ length: n }, (_, k) => {
      const vals = teams.map((t) => sortedFor(t)[k]?.rate ?? 0);
      return vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
    });
    const leagueAvg = kthAvg.reduce((s, v) => s + v, 0);
    const mineSorted = sortedFor(me);
    const mine = sums.find((s) => s.rosterId === myRosterId)!.sum;
    const rank = 1 + sums.filter((s) => s.sum > mine + 1e-9).length;
    const gap = Math.round((mine - leagueAvg) * 10) / 10;
    const third = Math.ceil(teams.length / 3);
    const label: PositionStrength["label"] =
      rank > teams.length - third || gap <= -3 ? "NEED" : rank <= third && gap >= 1.5 ? "STRENGTH" : "OK";
    const lastStarterAvg = kthAvg[n - 1] ?? 0;
    return {
      pos,
      slots: n,
      mine: Math.round(mine * 10) / 10,
      leagueAvg: Math.round(leagueAvg * 10) / 10,
      gap,
      rank,
      teams: teams.length,
      label,
      starters: mineSorted.slice(0, n),
      surplus: mineSorted.slice(n).filter((x) => !myLineup.has(x.id) && x.rate >= lastStarterAvg && x.rate > 0),
    };
  });
}

export type WaiverIdea = {
  id: string;
  gain: number;
  /** Points over the rest of the regular season (gain × weeks left). */
  seasonGain: number;
  bid: number | null;
  bidPct: number | null;
  drop: string | null;
  needPos: boolean;
};

/**
 * Free agents ranked by how much they lift your optimal lineup (gain/wk).
 * FAAB bid = 1% of remaining budget per 4 season-points added (cap 40%),
 * ×1.25 when the player is heavily trending (competition).
 */
export function waiverIdeas(args: {
  rosterPositions: string[];
  mine: string[];
  reserve: string[];
  freeAgents: RatedPlayer[];
  byId: Map<string, RatedPlayer>;
  needs: Set<string>;
  weeksLeft: number;
  faabRemaining: number | null;
  trending: Map<string, number>;
  /** Stash holds — never suggested as the cut. */
  holds?: Set<string>;
}): WaiverIdea[] {
  const { rosterPositions, mine, reserve, freeAgents, byId, needs, weeksLeft, faabRemaining, trending } = args;
  const holds = args.holds ?? new Set<string>();
  const base = lineupRate(rosterPositions, mine, byId);
  const slots = skillSlots(rosterPositions);
  const starters = new Set(
    optimizeLineup(
      slots,
      mine.filter((id) => byId.has(id)).map((id) => ({ id, pos: byId.get(id)!.pos })),
      (id) => availableRate(byId.get(id)!),
    ).fills.map((f) => f.playerId),
  );
  // Drop candidate: lowest-value skill bench player not on IR and not a starter.
  const dropPool = mine
    .map((id) => byId.get(id))
    .filter((p): p is RatedPlayer => !!p && !starters.has(p.id) && !reserve.includes(p.id) && !holds.has(p.id))
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0) || a.rate - b.rate);

  const ideas: WaiverIdea[] = [];
  for (const fa of freeAgents) {
    if (availableRate(fa) <= 0) continue;
    const gain = Math.round((lineupRate(rosterPositions, [...mine, fa.id], byId) - base) * 10) / 10;
    const needPos = needs.has(fa.pos);
    if (gain < 0.3 && !needPos) continue;
    const seasonGain = Math.round(gain * weeksLeft);
    const { bid, bidPct } = faabBid(gain, weeksLeft, faabRemaining, (trending.get(fa.id) ?? 0) >= 10000);
    const drop = dropPool.find((d) => d.id !== fa.id && (d.value ?? 0) < (fa.value ?? Infinity))?.id ?? dropPool[0]?.id ?? null;
    ideas.push({ id: fa.id, gain, seasonGain, bid, bidPct, drop, needPos });
  }
  const rate = (id: string) => byId.get(id)?.rate ?? 0;
  return ideas.sort((a, b) => b.gain - a.gain || Number(b.needPos) - Number(a.needPos) || rate(b.id) - rate(a.id)).slice(0, 10);
}

/** FAAB: 1% of remaining per 4 rest-of-season points (cap 40%), ×1.25 when heavily trending. */
export function faabBid(
  gain: number,
  weeksLeft: number,
  faabRemaining: number | null,
  hot = false,
): { bid: number | null; bidPct: number | null } {
  if (faabRemaining == null) return { bid: null, bidPct: null };
  const bidPct = Math.min(40, Math.max(gain > 0 ? 1 : 0, Math.round(((gain * weeksLeft) / 4) * (hot ? 1.25 : 1))));
  return { bidPct, bid: Math.max(gain > 0 ? 1 : 0, Math.round((faabRemaining * bidPct) / 100)) };
}

export type StashIdea = {
  id: string;
  /** HOLD = on your roster, keep; SPEC = free agent worth a cheap speculative add. */
  kind: "HOLD" | "SPEC";
  where: "bench" | "ir" | "fa";
  ifBack: number;
  /** Your lineup gain if he returns at ifBack, pts/g. */
  gainIfBack: number;
  /** Speculative price now vs. what the bid formula says once he's signed/healthy (weeks left minus a 2-week signing / 4-week IR lag). */
  bidNow: number | null;
  bidLater: number | null;
};

/**
 * Sidelined players (unsigned or long-term injured) with a real track record:
 * keep yours if they'd start for you on return; flag free agents with live
 * signals (recent headlines or a rising market) as cheap stashes now, before
 * a signing reprices them.
 */
export function stashIdeas(args: {
  rosterPositions: string[];
  mine: string[];
  reserve: string[];
  freeAgents: RatedPlayer[];
  byId: Map<string, RatedPlayer>;
  weeksLeft: number;
  faabRemaining: number | null;
}): StashIdea[] {
  const { rosterPositions, mine, reserve, freeAgents, byId, weeksLeft, faabRemaining } = args;
  const minePlayers = mine.map((id) => byId.get(id)).filter((p): p is RatedPlayer => !!p);
  const base = lineupRate(rosterPositions, mine.filter((id) => byId.has(id)), byId);
  const gainIf = (p: RatedPlayer) => {
    const sim = new Map(byId);
    sim.set(p.id, { ...p, team: p.team ?? "FA", injury: null, rate: p.ifBack ?? 0 });
    const ids = mine.includes(p.id) ? mine : [...mine, p.id];
    return Math.round((lineupRate(rosterPositions, ids, sim) - base) * 10) / 10;
  };
  const out: StashIdea[] = [];
  for (const p of minePlayers) {
    if (!isSidelined(p) || !p.ifBack) continue;
    const gainIfBack = gainIf(p);
    if (gainIfBack < 1) continue;
    out.push({ id: p.id, kind: "HOLD", where: reserve.includes(p.id) ? "ir" : "bench", ifBack: p.ifBack, gainIfBack, bidNow: null, bidLater: null });
  }
  for (const p of freeAgents) {
    if (!isSidelined(p) || !p.ifBack) continue;
    const signal = (p.newsCount ?? 0) > 0 || (p.trend30 ?? 0) > 0;
    if (!signal) continue;
    const gainIfBack = gainIf(p);
    if (gainIfBack < 1) continue;
    // Weeks he can actually help: unsigned ≈2 to sign and ramp; IR ≈4 minimum.
    const lag = p.team ? 4 : 2;
    const later = faabBid(gainIfBack, Math.max(1, weeksLeft - lag), faabRemaining, true);
    const now = faabRemaining != null ? Math.max(1, Math.round(faabRemaining * 0.01)) : null;
    out.push({ id: p.id, kind: "SPEC", where: "fa", ifBack: p.ifBack, gainIfBack, bidNow: now, bidLater: later.bid });
  }
  return out.sort((a, b) => b.gainIfBack - a.gainIfBack).slice(0, 6);
}

export type TradeIdea = {
  partnerRosterId: number;
  partner: string;
  target: string;
  send: string[];
  /** Your optimal-lineup change, pts/game. */
  myGain: number;
  /** Their optimal-lineup change, pts/game (≥ −0.5 to be realistic). */
  theirGain: number;
  targetValue: number;
  sendValue: number;
  /** sendValue with the 2-for-1 consolidation discount applied. */
  sendValueAdj: number;
  /** Don't pay more than this (115% of market, adjusted value). */
  maxValue: number;
  fit: string;
};

export function packageValue(values: number[]): number {
  const v = [...values].sort((a, b) => b - a);
  return Math.round((v[0] ?? 0) + SECOND_PIECE * (v[1] ?? 0));
}

/**
 * Two-sided trade search: for each upgrade target on another roster, try
 * every 1-for-1 and 2-for-1 package from your roster; keep packages where
 * your lineup gains ≥ 1 pt/g, theirs doesn't drop more than 0.5, and the
 * market value lands within 90–115% of the target's.
 */
export function tradeIdeas(args: {
  rosterPositions: string[];
  teams: TeamInput[];
  myRosterId: number;
  byId: Map<string, RatedPlayer>;
  strength: Map<number, PositionStrength[]>;
}): TradeIdea[] {
  const { rosterPositions, teams, myRosterId, byId, strength } = args;
  const me = teams.find((t) => t.rosterId === myRosterId);
  if (!me) return [];
  const myBase = lineupRate(rosterPositions, me.players, byId);
  const myPool = me.players
    .map((id) => byId.get(id))
    .filter((p): p is RatedPlayer => !!p && (SKILL_POS as readonly string[]).includes(p.pos) && (p.value ?? 0) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 12);
  const packages: RatedPlayer[][] = [];
  for (let i = 0; i < myPool.length; i++) {
    packages.push([myPool[i]]);
    for (let j = i + 1; j < myPool.length; j++) packages.push([myPool[i], myPool[j]]);
  }
  const myStrength = strength.get(myRosterId) ?? [];

  const ideas: TradeIdea[] = [];
  for (const other of teams) {
    if (other.rosterId === myRosterId) continue;
    const theirBase = lineupRate(rosterPositions, other.players, byId);
    for (const tid of other.players) {
      const t = byId.get(tid);
      if (!t || !(SKILL_POS as readonly string[]).includes(t.pos) || !(t.value && t.value > 0)) continue;
      if (t.injury && LONG_TERM.has(t.injury)) continue;
      const addOnly = lineupRate(rosterPositions, [...me.players, tid], byId) - myBase;
      if (addOnly < 1) continue;

      let best: TradeIdea | null = null;
      for (const pkg of packages) {
        const sendIds = pkg.map((p) => p.id);
        const adj = packageValue(pkg.map((p) => p.value ?? 0));
        if (adj < 0.9 * t.value || adj > 1.15 * t.value) continue;
        const myAfter = lineupRate(rosterPositions, [...me.players.filter((id) => !sendIds.includes(id)), tid], byId);
        const myGain = Math.round((myAfter - myBase) * 10) / 10;
        if (myGain < 1) continue;
        const theirAfter = lineupRate(rosterPositions, [...other.players.filter((id) => id !== tid), ...sendIds], byId);
        const theirGain = Math.round((theirAfter - theirBase) * 10) / 10;
        if (theirGain < -0.5) continue;
        const better =
          !best ||
          myGain + Math.min(theirGain, 2) > best.myGain + Math.min(best.theirGain, 2) ||
          (myGain === best.myGain && adj < best.sendValueAdj);
        if (better) {
          const theirStr = strength.get(other.rosterId) ?? [];
          const sentPos = Array.from(new Set(pkg.map((p) => p.pos)));
          const theirNeed = theirStr.filter((s) => s.label === "NEED" && sentPos.includes(s.pos)).map((s) => s.pos);
          const mySurplus = myStrength.filter((s) => s.surplus.length && sentPos.includes(s.pos)).map((s) => s.pos);
          const myNeed = myStrength.find((s) => s.pos === t.pos && s.label === "NEED");
          const parts = [
            myNeed ? `your ${t.pos} ranks ${myNeed.rank}/${myNeed.teams}` : null,
            theirNeed.length ? `their ${theirNeed.join("/")} is a need` : null,
            mySurplus.length ? `you have ${mySurplus.join("/")} depth` : null,
          ].filter(Boolean);
          best = {
            partnerRosterId: other.rosterId,
            partner: other.name,
            target: tid,
            send: sendIds,
            myGain,
            theirGain,
            targetValue: t.value,
            sendValue: pkg.reduce((s, p) => s + (p.value ?? 0), 0),
            sendValueAdj: adj,
            maxValue: Math.round(1.15 * t.value),
            fit: parts.join(" · "),
          };
        }
      }
      if (best) ideas.push(best);
    }
  }
  // Best first; at most two ideas per partner so the list stays varied.
  const perPartner = new Map<number, number>();
  return ideas
    .sort((a, b) => b.myGain + Math.min(b.theirGain, 2) - (a.myGain + Math.min(a.theirGain, 2)))
    .filter((i) => {
      const n = perPartner.get(i.partnerRosterId) ?? 0;
      perPartner.set(i.partnerRosterId, n + 1);
      return n < 2;
    })
    .slice(0, 8);
}
