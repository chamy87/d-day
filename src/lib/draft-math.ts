import type { SleeperDraft, SleeperPick } from "./sleeper";
import type { Ranked } from "./vbd";
import type { Position } from "@/components/ui/position-badge";

/** Snake-draft slot for a 1-indexed overall pick number. */
export function slotForPick(pickNo: number, teams: number): number {
  const round = Math.ceil(pickNo / teams);
  const idx = (pickNo - 1) % teams;
  return round % 2 === 1 ? idx + 1 : teams - idx;
}

/** "3.07" style pick label. */
export function pickLabel(pickNo: number, teams: number): string {
  const round = Math.ceil(pickNo / teams);
  const inRound = ((pickNo - 1) % teams) + 1;
  return `${round}.${String(inRound).padStart(2, "0")}`;
}

/** Picks between the next pick and the given slot's next turn (0 = on the clock). */
export function picksUntilSlot(nextPickNo: number, slot: number, teams: number, maxPicks: number): number | null {
  for (let no = nextPickNo; no <= maxPicks; no++) {
    if (slotForPick(no, teams) === slot) return no - nextPickNo;
  }
  return null;
}

export type RosterSlot = { slot: Position; player: SleeperPick | null; need: boolean };

const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);
const SFLX_ELIGIBLE = new Set(["QB", "RB", "WR", "TE"]);

/** Greedily fill this league's roster slots with a team's picks, in pick order. */
export function fillRoster(rosterPositions: string[], myPicks: SleeperPick[]): RosterSlot[] {
  const slots: { raw: string; display: Position; player: SleeperPick | null }[] = rosterPositions.map(
    (raw) => ({
      raw,
      display:
        raw === "SUPER_FLEX"
          ? "SFLX"
          : raw === "WRRB_FLEX" || raw === "REC_FLEX"
            ? "FLEX"
            : (["QB", "RB", "WR", "TE", "K", "DEF", "FLEX", "BN"].includes(raw) ? raw : "BN") as Position,
      player: null,
    }),
  );

  const fits = (raw: string, pos: string): boolean => {
    if (raw === pos) return true;
    if ((raw === "FLEX" || raw === "WRRB_FLEX" || raw === "REC_FLEX") && FLEX_ELIGIBLE.has(pos)) return true;
    if (raw === "SUPER_FLEX" && SFLX_ELIGIBLE.has(pos)) return true;
    return raw === "BN";
  };

  for (const pick of myPicks) {
    const pos = pick.metadata?.position ?? "";
    // direct slot first, then flex, then bench (slots are in league order)
    const target =
      slots.find((s) => !s.player && s.raw === pos) ??
      slots.find((s) => !s.player && s.raw !== "BN" && fits(s.raw, pos)) ??
      slots.find((s) => !s.player && s.raw === "BN");
    if (target) target.player = pick;
  }

  return slots.map((s) => ({
    slot: s.display,
    player: s.player,
    need: !s.player && s.raw !== "BN",
  }));
}

export type Suggestion = { player: Ranked; why: string };

export type LeagueStrategy = {
  /** rec scoring value: 1 = PPR, 0.5 = half, 0 = standard */
  rec: number;
  superflex: boolean;
  /** Picks this team still has, if known — gates K/DEF timing. */
  remainingPicks: number | null;
};

/**
 * Top suggestions: VBD, boosted for empty starting slots and tilted by
 * league type — PPR leans pass-catchers, standard leans RBs, superflex
 * front-loads QBs — with roster-construction guards (no third QB in 1QB
 * leagues, no K/DEF until the end game).
 */
export function suggestPicks(
  available: Ranked[],
  roster: RosterSlot[],
  strategy: LeagueStrategy,
  count = 3,
): Suggestion[] {
  const needPositions = new Set<string>();
  for (const s of roster) {
    if (!s.need) continue;
    if (s.slot === "FLEX") ["RB", "WR", "TE"].forEach((p) => needPositions.add(p));
    else if (s.slot === "SFLX") ["QB", "RB", "WR", "TE"].forEach((p) => needPositions.add(p));
    else needPositions.add(s.slot);
  }

  const owned: Record<string, number> = {};
  for (const s of roster) {
    const pos = s.player?.metadata?.position;
    if (pos) owned[pos] = (owned[pos] ?? 0) + 1;
  }

  const { rec, superflex, remainingPicks } = strategy;
  const endGame = remainingPicks != null && remainingPicks <= 3;
  const lean: Record<string, number> =
    rec >= 1
      ? { WR: 1.06, TE: 1.03, RB: 1 }
      : rec >= 0.5
        ? { WR: 1.03, RB: 1.02 }
        : { RB: 1.06 };
  const leanNote = rec >= 1 ? "PPR leans pass-catchers" : rec >= 0.5 ? "half-PPR" : "standard leans RB volume";

  // Balance guards: when remaining picks barely cover unfilled starting slots,
  // only suggest positions that fill one — no stacking a 5th RB while the TE
  // slot sits empty at the end of the draft.
  const unfilledStarters = roster.filter((s) => s.need).length;
  const mustFill = remainingPicks != null && remainingPicks <= unfilledStarters + 1;
  const directStarters: Record<string, number> = {};
  for (const s of roster) {
    if (!["FLEX", "SFLX", "BN"].includes(s.slot)) directStarters[s.slot] = (directStarters[s.slot] ?? 0) + 1;
  }

  const eligible = available.filter((p) => {
    if (mustFill && !needPositions.has(p.pos)) return false;
    if (p.pos === "QB" && (owned.QB ?? 0) >= (superflex ? 3 : 2)) return false;
    if (p.pos === "TE" && (owned.TE ?? 0) >= 2 && !needPositions.has("TE")) return false;
    if ((p.pos === "K" || p.pos === "DEF") && ((owned[p.pos] ?? 0) >= 1 || !endGame)) return false;
    return true;
  });

  const lastInTier = new Map<string, Ranked>();
  for (const p of eligible) {
    lastInTier.set(`${p.pos}:${p.tier}`, p); // last write wins = last in tier
  }

  return eligible
    .slice(0, 40)
    .map((p) => {
      let score = p.vbd * (lean[p.pos] ?? 1);
      if (needPositions.has(p.pos)) score += 10;
      if (superflex && p.pos === "QB" && (owned.QB ?? 0) < 2) score += 8;
      // Diminishing returns: starters at this position filled and 2+ spare —
      // a 5th tier-1 RB is worth less to you than balance elsewhere.
      const stacked =
        !needPositions.has(p.pos) && (owned[p.pos] ?? 0) >= (directStarters[p.pos] ?? 0) + 2;
      if (stacked) score *= 0.72;
      return { p, score, stacked };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ p, stacked }) => {
      let why = "Best VBD available.";
      const directNeed = roster.some((s) => s.need && s.slot === p.pos);
      if (mustFill && needPositions.has(p.pos)) {
        why = `${remainingPicks} pick${remainingPicks === 1 ? "" : "s"} left — lock your ${p.pos} starter.`;
      } else if (superflex && p.pos === "QB" && (owned.QB ?? 0) < 2) {
        why = "Superflex — QB2 before the position thins out.";
      } else if (p.adpDelta != null && p.adpDelta >= 8) {
        why = `Falling — goes ~${Math.round(p.adp ?? 0)} on average.`;
      } else if (directNeed) {
        why = `Fills your empty ${p.pos} slot.`;
      } else if (lastInTier.get(`${p.pos}:${p.tier}`) === p) {
        why = `Last ${p.pos} in Tier ${p.tier}.`;
      } else if (stacked) {
        why = `Value too big to pass — but your ${p.pos} room is already deep.`;
      } else if ((lean[p.pos] ?? 1) > 1) {
        why = `Best VBD available — ${leanNote}.`;
      }
      return { player: p, why };
    });
}

export type TeamGrade = {
  slot: number;
  totalVbd: number;
  steal: number;
  score: number;
  grade: string;
};

const GRADE_SCALE = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"];

/**
 * Post-draft grades per draft slot: VBD captured plus ADP steals (picks made
 * later than market price), graded on the league's curve.
 */
export function gradeDraft(board: Ranked[], picks: SleeperPick[], teams: number): TeamGrade[] {
  const byId = new Map(board.map((p) => [p.sleeperId, p]));
  const acc = new Map<number, { vbd: number; steal: number }>();
  for (let slot = 1; slot <= teams; slot++) acc.set(slot, { vbd: 0, steal: 0 });
  for (const p of picks) {
    const cur = acc.get(p.draft_slot);
    if (!cur) continue;
    const b = byId.get(p.player_id);
    if (!b) continue;
    cur.vbd += Math.max(0, b.vbd);
    if (b.adp != null) cur.steal += Math.max(0, Math.round(p.pick_no - b.adp));
  }
  const rows = [...acc.entries()].map(([slot, v]) => ({
    slot,
    totalVbd: Math.round(v.vbd),
    steal: v.steal,
    score: v.vbd + v.steal * 1.5,
  }));
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({
    ...r,
    grade: GRADE_SCALE[Math.min(GRADE_SCALE.length - 1, Math.floor((i / Math.max(1, rows.length)) * GRADE_SCALE.length))],
  }));
}

/** Scarcity warning: fewest remaining in the best live tier of a needed position. */
export function scarcityNote(available: Ranked[], roster: RosterSlot[]): string | null {
  const needed = new Set(roster.filter((s) => s.need && !["FLEX", "SFLX", "BN"].includes(s.slot)).map((s) => s.slot));
  let best: { pos: string; tier: number; left: number } | null = null;
  for (const pos of needed) {
    const ofPos = available.filter((p) => p.pos === pos);
    if (!ofPos.length) continue;
    const tier = ofPos[0].tier;
    const left = ofPos.filter((p) => p.tier === tier).length;
    if (left <= 2 && (!best || left < best.left)) best = { pos, tier, left };
  }
  return best ? `Only ${best.left} ${best.pos}${best.left === 1 ? "" : "s"} left in Tier ${best.tier}.` : null;
}

/** Remaining seconds on the pick clock, or null when not applicable. */
export function clockRemaining(draft: SleeperDraft, nowMs: number): number | null {
  if (draft.status !== "drafting" || !draft.settings.pick_timer || !draft.last_picked) return null;
  return Math.max(0, Math.round((draft.last_picked + draft.settings.pick_timer * 1000 - nowMs) / 1000));
}
