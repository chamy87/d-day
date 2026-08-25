"use client";

import React from "react";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style" | "aria-label"> {
  /** Accessible name (aria-label + title). */
  label: string;
  size?: "sm" | "md" | "lg";
  /** Toggled/selected state (amber tint). */
  active?: boolean;
  style?: React.CSSProperties;
}

/** Square icon-only button for toolbars and row actions. */
export function IconButton({ label, size = "md", active, disabled, children, style, ...rest }: IconButtonProps) {
  const d = size === "sm" ? 28 : size === "lg" ? 44 : 36;
  const [hover, setHover] = React.useState(false);
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      style={{
        width: d,
        height: d,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--accent-dim)" : hover && !disabled ? "var(--bg-3)" : "transparent",
        color: active ? "var(--accent)" : hover ? "var(--text-body)" : "var(--text-muted)",
        border: "1px solid " + (active ? "rgba(255,180,61,.35)" : "transparent"),
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all var(--dur-fast) var(--ease-snap)",
        flexShrink: 0,
        ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {children}
    </button>
  );
}
