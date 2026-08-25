/**
 * Value-based drafting math (see guidelines/architecture.md).
 *
 * scoreProjection: projected points under this league's exact scoring_settings.
 * computeVBD: replacement baseline per position from roster_positions ×
 * total_rosters; VBD(player) = points − baseline(pos).
 */

export type StatLine = Record<string, number>;

export type Projected = {
  sleeperId: string;
  name: string;
  team: string | null;
  pos: string; // QB | RB | WR | TE | K | DEF
  points: number;
  bye: number | null;
  injury: string | null;
  adp: number | null;
};

export type Ranked = Projected & {
  rank: number;
  vbd: number;
  tier: number;
  adpDelta: number | null;
};

/** Projected points under this league's exact scoring_settings. */
export function scoreProjection(stats: StatLine, scoring: Record<string, number>): number {
  let pts = 0;
  for (const [key, weight] of Object.entries(scoring)) {
    const v = stats[key];
    if (v) pts += v * weight;
  }
  return Math.round(pts * 10) / 10;
}

/**
 * Starters(pos) = direct slots + FLEX share (RB/WR/TE) + SUPER_FLEX share
 * (mostly QB). Shares are fixed heuristics: FLEX → RB .35 / WR .45 / TE .20;
 * SUPER_FLEX → QB .85 / RB .075 / WR .075.
 */
export function startersPerPosition(rosterPositions: string[]): Record<string, number> {
  const starters: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const slot of rosterPositions) {
    if (slot in starters) starters[slot] += 1;
    else if (slot === "FLEX" || slot === "WRRB_FLEX" || slot === "REC_FLEX") {
      starters.RB += 0.35;
      starters.WR += 0.45;
      starters.TE += 0.2;
    } else if (slot === "SUPER_FLEX") {
      starters.QB += 0.85;
      starters.RB += 0.075;
      starters.WR += 0.075;
    }
  }
  return starters;
}

export function computeVBD(
  players: Projected[],
  league: { rosterPositions: string[]; teams: number },
): Ranked[] {
  const starters = startersPerPosition(league.rosterPositions);
  const byPos = new Map<string, Projected[]>();
  for (const p of players) {
    const list = byPos.get(p.pos) ?? [];
    list.push(p);
    byPos.set(p.pos, list);
  }

  const baselines = new Map<string, number>();
  for (const [pos, list] of byPos) {
    list.sort((a, b) => b.points - a.points);
    const baselineRank = Math.max(1, Math.round((starters[pos] ?? 0) * league.teams));
    const baselinePlayer = list[Math.min(baselineRank, list.length) - 1];
    baselines.set(pos, baselinePlayer?.points ?? 0);
  }

  const ranked = players
    .map((p) => ({
      ...p,
      vbd: Math.round((p.points - (baselines.get(p.pos) ?? 0)) * 10) / 10,
    }))
    .sort((a, b) => b.vbd - a.vbd)
    .map((p, i) => ({
      ...p,
      rank: i + 1,
      tier: 0,
      adpDelta: p.adp != null ? Math.round(p.adp - (i + 1)) : null,
    }));

  return assignTiers(ranked);
}

/**
 * Tier assignment from VBD gaps: a drop of more than GAP points between
 * consecutive players opens a new tier (computed tiers — Boris Chen tiers can
 * replace these once that ingest lands). Tier color scale caps at 6.
 */
const TIER_GAP = 8;

function assignTiers(ranked: (Ranked & { tier: number })[]): Ranked[] {
  let tier = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (i > 0 && ranked[i - 1].vbd - ranked[i].vbd > TIER_GAP) tier += 1;
    ranked[i].tier = Math.min(tier, 6);
  }
  return ranked;
}
