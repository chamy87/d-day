import React from "react";

export interface TagProps {
  /** value (green), reach (red), accent (amber), warn (yellow), neutral. */
  tone?: "neutral" | "value" | "reach" | "accent" | "warn";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const TONES: Record<string, React.CSSProperties> = {
  neutral: {
    color: "var(--text-muted)",
    background: "var(--bg-3)",
    border: "1px solid var(--line-2)",
  },
  value: {
    color: "var(--value)",
    background: "var(--value-dim)",
    border: "1px solid rgba(61,220,151,.35)",
  },
  reach: {
    color: "var(--reach)",
    background: "var(--reach-dim)",
    border: "1px solid rgba(255,92,92,.35)",
  },
  accent: {
    color: "var(--accent)",
    background: "var(--accent-dim)",
    border: "1px solid rgba(255,180,61,.35)",
  },
  warn: {
    color: "var(--warn)",
    background: "rgba(255,210,61,.12)",
    border: "1px solid rgba(255,210,61,.3)",
  },
};

export function Tag({ tone = "neutral", children, style }: TagProps) {
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "var(--radius-pill)",
        display: "inline-block",
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        ...TONES[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
