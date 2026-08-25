"use client";

import React from "react";
import { PositionBadge, type Position } from "./position-badge";
import { StatDelta } from "./stat-delta";
import { Tag } from "./tag";

export interface PlayerRowProps {
  rank?: number;
  name: string;
  pos: Position;
  team?: string | null;
  bye?: number | null;
  vbd?: number | null;
  adpDelta?: number | null;
  injury?: string | null;
  drafted?: boolean;
  onClick?: () => void;
  trailing?: React.ReactNode;
  style?: React.CSSProperties;
}

/** The draft board's atomic row. `drafted` strikes it out. */
export function PlayerRow({
  rank,
  name,
  pos,
  team,
  bye,
  vbd,
  adpDelta,
  injury,
  drafted,
  onClick,
  trailing,
  style,
}: PlayerRowProps) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        minHeight: 44,
        cursor: onClick ? "pointer" : "default",
        background: hover && onClick ? "var(--surface-raised)" : "transparent",
        borderBottom: "1px solid var(--line-1)",
        opacity: drafted ? 0.35 : 1,
        textDecoration: drafted ? "line-through" : "none",
        transition: "background var(--dur-fast)",
        ...style,
      }}
    >
      {rank != null && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--text-faint)",
            width: 24,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {rank}
        </span>
      )}
      <PositionBadge pos={pos} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: "var(--text-body-size)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </span>
          {injury && <Tag tone="reach">{injury}</Tag>}
        </div>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
          {team ?? "FA"}
          {bye != null ? " · BYE " + bye : ""}
        </span>
      </div>
      {vbd != null && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--text-body)",
            flexShrink: 0,
          }}
        >
          {vbd > 0 ? "+" : ""}
          {vbd}
        </span>
      )}
      {adpDelta != null && <StatDelta value={adpDelta} style={{ flexShrink: 0 }} />}
      {trailing}
    </div>
  );
}
