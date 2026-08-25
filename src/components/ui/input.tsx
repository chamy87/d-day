"use client";

import React from "react";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "style"> {
  /** Uppercase micro-label above the field. */
  label?: string;
  /** Helper line under the field. */
  hint?: string;
  /** Monospace value (league IDs, numbers). */
  mono?: boolean;
  size?: "md" | "lg";
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

export function Input({ label, hint, mono, size = "md", style, inputStyle, ...rest }: InputProps) {
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
      <input
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
          height: size === "lg" ? "var(--control-h-lg)" : "var(--control-h)",
          background: "var(--bg-1)",
          border: "1px solid " + (focus ? "var(--accent)" : "var(--border-strong)"),
          borderRadius: "var(--radius-sm)",
          color: "var(--text-body)",
          padding: "0 12px",
          fontSize: size === "lg" ? 16 : "var(--text-body-size)",
          fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
          outline: "none",
          boxShadow: focus ? "0 0 0 3px var(--accent-dim)" : "none",
          transition: "all var(--dur-fast)",
          ...inputStyle,
        }}
      />
      {hint && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>{hint}</span>}
    </label>
  );
}
