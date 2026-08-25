import React from "react";

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX" | "SFLX" | "BN";

const POS: Record<Position, string> = {
  QB: "var(--pos-qb)",
  RB: "var(--pos-rb)",
  WR: "var(--pos-wr)",
  TE: "var(--pos-te)",
  K: "var(--pos-k)",
  DEF: "var(--pos-def)",
  FLEX: "var(--pos-flex)",
  SFLX: "var(--pos-flex)",
  BN: "var(--fg-3)",
};

export interface PositionBadgeProps {
  pos: Position;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

/** Position identity chip in the fixed position palette. Mono, uppercase, tinted. */
export function PositionBadge({ pos, size = "md", style }: PositionBadgeProps) {
  const c = POS[pos] ?? "var(--fg-3)";
  const s: React.CSSProperties =
    size === "sm" ? { fontSize: 9, padding: "1px 5px" } : { fontSize: 10, padding: "2px 7px" };
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        letterSpacing: ".06em",
        color: c,
        background: `color-mix(in srgb,${c} 14%,transparent)`,
        border: `1px solid color-mix(in srgb,${c} 40%,transparent)`,
        borderRadius: 4,
        display: "inline-block",
        lineHeight: 1.5,
        ...s,
        ...style,
      }}
    >
      {pos}
    </span>
  );
}

/** Map Sleeper roster_positions values to display positions. */
export function toPosition(sleeperSlot: string): Position {
  switch (sleeperSlot) {
    case "SUPER_FLEX":
      return "SFLX";
    case "WRRB_FLEX":
    case "REC_FLEX":
    case "FLEX":
      return "FLEX";
    case "QB":
    case "RB":
    case "WR":
    case "TE":
    case "K":
    case "DEF":
    case "BN":
      return sleeperSlot;
    default:
      return "BN";
  }
}
