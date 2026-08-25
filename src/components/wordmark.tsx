import React from "react";

/** Type-set wordmark — no logo asset exists by design; never draw a mark. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontStretch: "125%",
        fontWeight: 850,
        fontSize: size,
        letterSpacing: "-.02em",
        lineHeight: 1,
      }}
    >
      <span style={{ color: "var(--accent)" }}>D-</span>DAY
    </span>
  );
}
