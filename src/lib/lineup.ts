/**
 * Lineup optimizer shared by start/sit (weekly projections) and the
 * roster-needs / trade engine (rest-of-season scoring rates).
 *
 * Exact, not greedy: slots × players solved as an assignment problem, so
 * overlapping flex slots (FLEX, WRRB_FLEX, REC_FLEX, SUPER_FLEX) never strand
 * points. Pure — runs on server and client.
 */

export const SLOT_ELIGIBLE: Record<string, string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF"],
  FLEX: ["RB", "WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
  REC_FLEX: ["WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
};

/**
 * Probability a designated player suits up. Questionable players play ~80%
 * of the time historically; doubtful ~20%; everything else is a zero.
 */
export const PLAY_PROB: Record<string, number> = { Q: 0.8, D: 0.2, OUT: 0, IR: 0, PUP: 0, SUS: 0, NA: 0 };

export type LineupPlayer = {
  id: string;
  pos: string;
  /** Raw projection (league scoring) before injury/bye adjustment. */
  proj: number | null;
  injury: string | null;
  onBye: boolean;
  /** Game already kicked off — Sleeper won't let the player move. */
  locked?: boolean;
};

export function expectedPoints(p: LineupPlayer): number {
  if (p.onBye) return 0;
  const prob = p.injury ? (PLAY_PROB[p.injury] ?? 1) : 1;
  return Math.round((p.proj ?? 0) * prob * 10) / 10;
}

/** Starting slots in Sleeper's order (starters[] aligns with these). */
export function startingSlots(rosterPositions: string[]): string[] {
  return rosterPositions.filter((s) => s !== "BN" && s !== "IR" && s !== "TAXI");
}

/** Min-cost assignment (rows ≤ cols). Returns col index per row. */
function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const m = cost[0]?.length ?? 0;
  if (!n || !m) return [];
  const INF = Number.POSITIVE_INFINITY;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const out = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1;
  return out;
}

export type SlotFill = { slot: string; playerId: string | null; points: number };

/**
 * Best lineup for the given slots. `fixed` pins players to slot indexes
 * (locked games, IDP slots we don't model). Ties favor `prefer` (current
 * starters) so the optimizer never suggests a pointless swap.
 */
export function optimizeLineup(
  slots: string[],
  players: { id: string; pos: string }[],
  score: (id: string) => number,
  opts: {
    fixed?: Map<number, string | null>;
    exclude?: Set<string>;
    /** Current placements (player → slot index): ties keep players where they are. */
    prefer?: Map<string, number>;
  } = {},
): { fills: SlotFill[]; total: number } {
  const fixed = opts.fixed ?? new Map<number, string | null>();
  const pinned = new Set(Array.from(fixed.values()).filter(Boolean) as string[]);
  const open = slots.map((s, i) => i).filter((i) => !fixed.has(i) && SLOT_ELIGIBLE[slots[i]]);
  const pool = players.filter((p) => !pinned.has(p.id) && !opts.exclude?.has(p.id));

  const fills: SlotFill[] = slots.map((slot, i) => {
    const id = fixed.get(i) ?? null;
    return { slot, playerId: id, points: id ? score(id) : 0 };
  });

  if (open.length && pool.length) {
    // Pad with dummy columns so every slot can stay empty (rows ≤ cols).
    const cols = Math.max(pool.length, open.length) + open.length;
    const BIG = 1e6;
    const cost = open.map((si) =>
      Array.from({ length: cols }, (_, c) => {
        if (c >= pool.length) return 0; // empty slot
        const p = pool[c];
        if (!SLOT_ELIGIBLE[slots[si]].includes(p.pos)) return BIG;
        const at = opts.prefer?.get(p.id);
        const bonus = at === undefined ? 0 : at === si ? 0.002 : 0.001;
        return -(score(p.id) + bonus);
      }),
    );
    const assign = hungarian(cost);
    open.forEach((si, r) => {
      const c = assign[r];
      if (c >= 0 && c < pool.length && cost[r][c] < 0) {
        fills[si] = { slot: slots[si], playerId: pool[c].id, points: score(pool[c].id) };
      } else if (c >= 0 && c < pool.length && cost[r][c] === 0) {
        // Zero-point but eligible (e.g. everyone left is on bye) — still fill.
        fills[si] = { slot: slots[si], playerId: pool[c].id, points: 0 };
      }
    });
  }
  const total = Math.round(fills.reduce((s, f) => s + f.points, 0) * 10) / 10;
  return { fills, total };
}

export type LineupMove = { start: string; bench: string | null; slot: string; gain: number };
export type LineupAlert = { playerId: string | null; kind: "OUT" | "BYE" | "EMPTY" | "Q" | "D"; slot: string; pivot?: string | null };

export type LineupPlan = {
  slots: { slot: string; current: string | null; optimal: string | null; currentPts: number; optimalPts: number }[];
  currentTotal: number;
  optimalTotal: number;
  gain: number;
  moves: LineupMove[];
  alerts: LineupAlert[];
};

/** Compare the set lineup to the optimum for one week. */
export function planLineup(
  rosterPositions: string[],
  starters: string[],
  roster: string[],
  byId: Record<string, LineupPlayer | undefined>,
): LineupPlan {
  const slots = startingSlots(rosterPositions);
  const pts = (id: string) => (byId[id] ? expectedPoints(byId[id]!) : 0);
  const current = slots.map((_, i) => {
    const id = starters[i];
    return id && id !== "0" ? id : null;
  });

  // Locked starters stay put; unmodeled (IDP) slots stay as set; locked bench can't enter.
  const fixed = new Map<number, string | null>();
  slots.forEach((slot, i) => {
    const id = current[i];
    if (!SLOT_ELIGIBLE[slot] || (id && byId[id]?.locked)) fixed.set(i, id);
  });
  const exclude = new Set(roster.filter((id) => byId[id]?.locked && !current.includes(id)));
  const players = roster.filter((id) => byId[id]).map((id) => ({ id, pos: byId[id]!.pos }));
  const prefer = new Map<string, number>();
  current.forEach((id, i) => id && prefer.set(id, i));
  const best = optimizeLineup(slots, players, pts, { fixed, exclude, prefer });

  const rows = slots.map((slot, i) => ({
    slot,
    current: current[i],
    optimal: best.fills[i].playerId,
    currentPts: current[i] ? pts(current[i]!) : 0,
    optimalPts: best.fills[i].points,
  }));
  const currentTotal = Math.round(rows.reduce((s, r) => s + r.currentPts, 0) * 10) / 10;
  const optimalTotal = best.total;

  // Pair "start" with "bench" by slot so each move reads as one decision.
  const optimalSet = new Set(rows.map((r) => r.optimal).filter(Boolean) as string[]);
  const currentSet = new Set(rows.map((r) => r.current).filter(Boolean) as string[]);
  // Pair each new starter with the player leaving that same slot; leftovers by points.
  const outs = rows
    .map((r, i) => ({ id: r.current, i }))
    .filter((o) => !o.id || !optimalSet.has(o.id));
  const used = new Set<number>();
  const pairs: { start: string; out: (typeof outs)[number] | null; slot: string }[] = [];
  rows.forEach((r, i) => {
    if (!r.optimal || currentSet.has(r.optimal)) return;
    const same = outs.find((o) => o.i === i && !used.has(o.i));
    if (same) used.add(same.i);
    pairs.push({ start: r.optimal, out: same ?? null, slot: r.slot });
  });
  const rest = outs.filter((o) => !used.has(o.i)).sort((a, b) => (a.id ? pts(a.id) : -1) - (b.id ? pts(b.id) : -1));
  for (const p of pairs) if (!p.out) p.out = rest.shift() ?? null;
  const moves: LineupMove[] = pairs
    .map((p) => ({
      start: p.start,
      bench: p.out?.id ?? null,
      slot: p.slot,
      gain: Math.round((pts(p.start) - (p.out?.id ? pts(p.out.id) : 0)) * 10) / 10,
    }))
    .sort((a, b) => b.gain - a.gain)
    .filter((m) => m.gain > 0.05);

  // Alerts on what's actually set right now.
  // Pivots come from players the plan leaves benched; alerts skip starters a move already replaces.
  const bench = roster.filter((id) => !currentSet.has(id) && !optimalSet.has(id) && byId[id] && !byId[id]!.locked);
  const replaced = new Set(moves.map((m) => m.bench).filter(Boolean) as string[]);
  const alerts: LineupAlert[] = [];
  rows.forEach((r) => {
    if (!SLOT_ELIGIBLE[r.slot]) return;
    if (!r.current) {
      alerts.push({ playerId: null, kind: "EMPTY", slot: r.slot });
      return;
    }
    const p = byId[r.current];
    if (!p || p.locked || replaced.has(p.id)) return;
    const pivot = () =>
      bench
        .filter((id) => SLOT_ELIGIBLE[r.slot].includes(byId[id]!.pos) && pts(id) > 0)
        .sort((a, b) => pts(b) - pts(a))[0] ?? null;
    if (p.onBye) alerts.push({ playerId: p.id, kind: "BYE", slot: r.slot, pivot: pivot() });
    else if (p.injury && (PLAY_PROB[p.injury] ?? 1) === 0) alerts.push({ playerId: p.id, kind: "OUT", slot: r.slot, pivot: pivot() });
    else if (p.injury === "D") alerts.push({ playerId: p.id, kind: "D", slot: r.slot, pivot: pivot() });
    else if (p.injury === "Q") alerts.push({ playerId: p.id, kind: "Q", slot: r.slot, pivot: pivot() });
  });

  return {
    slots: rows,
    currentTotal,
    optimalTotal,
    gain: Math.round((optimalTotal - currentTotal) * 10) / 10,
    moves,
    alerts,
  };
}

export type ReserveRules = {
  slots: number;
  allowOut: boolean;
  allowDoubtful: boolean;
  allowSus: boolean;
  allowNa: boolean;
};

export type IrMove = { kind: "ACTIVATE" | "TO_IR" | "IR_FULL"; playerId: string };

/** Whether Sleeper lets this designation sit in an IR slot under the league's rules. */
export function irEligible(designation: string | null | undefined, rules: ReserveRules): boolean {
  switch (designation) {
    case "IR":
    case "PUP":
      return true;
    case "OUT":
      return rules.allowOut;
    case "D":
      return rules.allowDoubtful;
    case "SUS":
      return rules.allowSus;
    case "NA":
      return rules.allowNa;
    default:
      return false;
  }
}

/**
 * IR-slot housekeeping: activate players no longer eligible (Sleeper blocks
 * your adds until you do), and move eligible bench players into open IR
 * slots to free a bench spot.
 */
export function irMoves(
  players: string[],
  reserve: string[],
  designation: (id: string) => string | null | undefined,
  rules: ReserveRules,
): IrMove[] {
  const moves: IrMove[] = [];
  for (const id of reserve) if (!irEligible(designation(id), rules)) moves.push({ kind: "ACTIVATE", playerId: id });
  let open = rules.slots - reserve.length + moves.length;
  for (const id of players) {
    if (reserve.includes(id) || !irEligible(designation(id), rules)) continue;
    moves.push({ kind: open > 0 ? "TO_IR" : "IR_FULL", playerId: id });
    open--;
  }
  return moves;
}
