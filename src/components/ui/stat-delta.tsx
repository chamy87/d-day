import React from "react";

export interface StatDeltaProps {
  /** Signed number; sign picks glyph and color. Positive = green ▲. */
  value: number;
  suffix?: string;
  label?: string;
  style?: React.CSSProperties;
}

/** Mono ▲/▼ delta readout — value-vs-ADP, projection swings. */
export function StatDelta({ value, suffix = "", label, style }: StatDeltaProps) {
  const up = value > 0;
  const flat = value === 0;
  const c = flat ? "var(--text-faint)" : up ? "var(--value)" : "var(--reach)";
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        color: c,
        display: "inline-flex",
        alignItems: "baseline",
        gap: 4,
        ...style,
      }}
    >
      <span>
        {flat ? "·" : up ? "▲" : "▼"}
        {Math.abs(value)}
        {suffix}
      </span>
      {label && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "var(--font-body)" }}>
          {label}
        </span>
      )}
    </span>
  );
}
