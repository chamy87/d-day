"use client";

import React from "react";

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "style"> {
  label?: string;
  options: Array<string | { value: string; label: string }>;
  size?: "md" | "lg";
  style?: React.CSSProperties;
}

/** Styled native select (week pickers, team pickers). ▼ glyph caret. */
export function Select({ label, options, size = "md", style, ...rest }: SelectProps) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            letterSpacing: "var(--track-caps)",
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}
        >
          {label}
        </span>
      )}
      <div style={{ position: "relative" }}>
        <select
          {...rest}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            width: "100%",
            height: size === "lg" ? "var(--control-h-lg)" : "var(--control-h)",
            background: "var(--bg-1)",
            border: "1px solid " + (focus ? "var(--accent)" : "var(--border-strong)"),
            borderRadius: "var(--radius-sm)",
            color: "var(--text-body)",
            padding: "0 32px 0 12px",
            fontSize: "var(--text-body-size)",
            fontFamily: "var(--font-body)",
            outline: "none",
            boxShadow: focus ? "0 0 0 3px var(--accent-dim)" : "none",
            cursor: "pointer",
          }}
        >
          {options.map((o) =>
            typeof o === "string" ? (
              <option key={o} value={o}>
                {o}
              </option>
            ) : (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ),
          )}
        </select>
        <span
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-faint)",
            pointerEvents: "none",
            fontSize: 10,
          }}
        >
          ▼
        </span>
      </div>
    </label>
  );
}
