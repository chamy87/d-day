"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type TeamOption = { value: string; label: string; slot?: number | null };

export function teamInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * First-run team picker: modal grid of team cards, one tap to claim a team,
 * skippable for spectators. (UX brief item 1.)
 */
export function TeamPickerModal({
  options,
  onPick,
  onSkip,
}: {
  options: TeamOption[];
  onPick: (value: string) => void;
  onSkip: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,14,17,.8)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
    >
      <Card
        title="Which team is yours?"
        style={{ width: 640, maxWidth: "100%", maxHeight: "85dvh", overflowY: "auto" }}
        action={
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Just browsing
          </Button>
        }
      >
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
          One tap — unlocks your roster, suggested picks and &quot;you&apos;re up in N&quot;. Change it
          anytime from the header.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {options.map((t) => (
            <button
              key={t.value}
              onClick={() => onPick(t.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--bg-1)",
                border: "1px solid var(--line-2)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                cursor: "pointer",
                color: "var(--text-body)",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                textAlign: "left",
                minHeight: 48,
                transition: "all var(--dur-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.background = "var(--accent-dim)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--line-2)";
                e.currentTarget.style.background = "var(--bg-1)";
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--bg-3)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  flexShrink: 0,
                }}
              >
                {teamInitials(t.label)}
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.label}
              </span>
              {t.slot != null && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>
                  #{t.slot}
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/** Compact header chip showing the chosen team; tap to change. */
export function TeamChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Change team"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--radius-pill)",
        padding: "3px 10px 3px 4px",
        cursor: "pointer",
        color: "var(--text-muted)",
        fontSize: 11,
        fontFamily: "var(--font-body)",
        maxWidth: 180,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "var(--bg-3)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {teamInitials(label)}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}
