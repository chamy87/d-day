"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Tag } from "@/components/ui/tag";

const TERMS: { term: string; def: string }[] = [
  {
    term: "VBD",
    def: "Value Based Drafting — projected points above a replacement-level starter at the same position in your league. The board ranks by it. This is the \"adds to your team\" number.",
  },
  {
    term: "PROJ",
    def: "Projected season points under your league's exact scoring settings.",
  },
  {
    term: "ADP",
    def: "Average Draft Position — where the market takes a player across recent mock drafts (FantasyFootballCalculator).",
  },
  {
    term: "▲12 / ▼5",
    def: "Board rank vs ADP. ▲12 = you'd get this player ~12 picks cheaper than the market takes them. Green is a discount, red means the market drafts them earlier than we rank them.",
  },
  {
    term: "VALUE tag",
    def: "The player is falling past their market price — available later than ADP. It's a discount signal, not extra points. A lower-VBD player with a big VALUE number is a bargain, not a better player.",
  },
  {
    term: "FC VALUE",
    def: "FantasyCalc trade-market value for your league's shape. Higher = more trade capital; useful for trades, not for start/sit.",
  },
  {
    term: "TIER",
    def: "Boris Chen tier groups — players inside a tier are considered interchangeable. Draft the position window, not the name.",
  },
  { term: "BYE", def: "The week that player's NFL team doesn't play." },
  {
    term: "Q / D / OUT / IR",
    def: "Injury designations: Questionable, Doubtful, Out, Injured Reserve.",
  },
  { term: "NEED", def: "A starting slot on your roster that's still empty." },
  { term: "SNIPED", def: "A player in your queue that someone else drafted." },
  { term: "SFLX", def: "Superflex slot — a flex that can also start a QB." },
  { term: "FAAB", def: "Free-agent acquisition budget — dollars you bid on waiver players." },
  {
    term: "ADP steals",
    def: "In draft grades: picks made later than market ADP — value captured relative to price.",
  },
];

/** "?" header affordance opening the abbreviations glossary. */
export function GlossaryButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <IconButton label="Glossary — what do these abbreviations mean?" size="sm" onClick={() => setOpen(true)}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>?</span>
      </IconButton>
      {open && (
        <div
          onClick={() => setOpen(false)}
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
          <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "100%" }}>
            <Card
              title="Glossary"
              style={{ maxHeight: "85dvh", overflowY: "auto" }}
              action={
                <IconButton label="Close" size="sm" onClick={() => setOpen(false)}>
                  <span style={{ fontSize: 12 }}>✕</span>
                </IconButton>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {TERMS.map((t) => (
                  <div key={t.term} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <Tag tone="neutral" style={{ flexShrink: 0, minWidth: 82, textAlign: "center" }}>
                      {t.term}
                    </Tag>
                    <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{t.def}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
