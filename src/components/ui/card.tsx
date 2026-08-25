import React from "react";

export interface CardProps {
  /** Uppercase panel header (MY ROSTER, ON THE CLOCK). */
  title?: string;
  /** Right-aligned header node. */
  action?: React.ReactNode;
  /** Body padding (off for lists/tables). */
  pad?: boolean;
  /** Amber glow ring — on-the-clock state. */
  glow?: boolean;
  /** Body becomes a flex column that fills the card — required for children
   *  that scroll internally (flex chains break at plain block wrappers). */
  fill?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({ title, action, pad = true, glow, fill, children, style }: CardProps) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-card)",
        borderRadius: "var(--radius-lg)",
        boxShadow: glow ? "var(--glow-accent)" : "var(--shadow-card)",
        overflow: "hidden",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "10px 16px",
            borderBottom: "1px solid var(--line-1)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              letterSpacing: "var(--track-caps)",
              textTransform: "uppercase",
              color: "var(--text-faint)",
            }}
          >
            {title}
          </span>
          {action}
        </div>
      )}
      <div
        style={{
          padding: pad ? "var(--card-pad)" : 0,
          ...(fill ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}
