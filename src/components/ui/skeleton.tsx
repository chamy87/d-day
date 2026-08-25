import React from "react";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  round?: boolean;
  style?: React.CSSProperties;
}

/** Shimmer loading placeholder; every loading state uses these, never spinners. */
export function Skeleton({ width = "100%", height = 16, round, style }: SkeletonProps) {
  return (
    <span
      className="dday-skeleton"
      style={{
        display: "block",
        width,
        height,
        borderRadius: round ? "var(--radius-pill)" : "var(--radius-sm)",
        ...style,
      }}
    />
  );
}
