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

/** Top suggestions: VBD with a boost for empty starting slots; one-line why. */
export function suggestPicks(
  available: Ranked[],
  roster: RosterSlot[],
  count = 3,
): Suggestion[] {
  const needPositions = new Set<string>();
  for (const s of roster) {
    if (!s.need) continue;
    if (s.slot === "FLEX") ["RB", "WR", "TE"].forEach((p) => needPositions.add(p));
    else if (s.slot === "SFLX") ["QB", "RB", "WR", "TE"].forEach((p) => needPositions.add(p));
    else needPositions.add(s.slot);
  }

  const lastInTier = new Map<string, Ranked>();
  for (const p of available) {
    lastInTier.set(`${p.pos}:${p.tier}`, p); // last write wins = last in tier
  }

  return available
    .slice(0, 40)
    .map((p) => ({ p, score: p.vbd + (needPositions.has(p.pos) ? 10 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ p }) => {
      let why = "Best VBD available.";
      const directNeed = roster.some((s) => s.need && s.slot === p.pos);
      if (p.adpDelta != null && p.adpDelta >= 8) {
        why = `Falling — goes ~${Math.round(p.adp ?? 0)} on average.`;
      } else if (directNeed) {
        why = `Fills your empty ${p.pos} slot.`;
      } else if (lastInTier.get(`${p.pos}:${p.tier}`) === p) {
        why = `Last ${p.pos} in Tier ${p.tier}.`;
      }
      return { player: p, why };
    });
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
