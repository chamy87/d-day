"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { PositionBadge, toPosition } from "@/components/ui/position-badge";
import { Wordmark } from "@/components/wordmark";
import type { LeagueSummary } from "@/app/api/league/[id]/route";

const STATUS_TAG: Record<string, { tone: "accent" | "value" | "neutral"; label: string }> = {
  drafting: { tone: "accent", label: "DRAFTING" },
  pre_draft: { tone: "neutral", label: "PRE-DRAFT" },
  in_season: { tone: "value", label: "IN SEASON" },
  complete: { tone: "neutral", label: "COMPLETE" },
};

export function Landing() {
  const router = useRouter();
  const [id, setId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [league, setLeague] = React.useState<LeagueSummary | null>(null);

  const lookup = async () => {
    const trimmed = id.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setLeague(null);
    try {
      const res = await fetch(`/api/league/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lookup failed — try again.");
      } else {
        setLeague(data as LeagueSummary);
      }
    } catch {
      setError("Lookup failed — try again.");
    } finally {
      setLoading(false);
    }
  };

  const status = league ? (STATUS_TAG[league.status] ?? STATUS_TAG.pre_draft) : null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        gap: 32,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <Wordmark size={72} />
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "var(--track-caps)",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            marginTop: 10,
          }}
        >
          Fantasy football draft assistant
        </div>
        <div style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 14, maxWidth: 440 }}>
          Paste your Sleeper league ID. No login, no setup — rankings tuned to your league&apos;s
          exact scoring and roster.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", width: "100%", maxWidth: 480 }}>
        <Input
          label="Sleeper league ID"
          mono
          size="lg"
          placeholder="992093874321055744"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          style={{ flex: 1 }}
        />
        <Button variant="primary" size="lg" onClick={lookup} disabled={loading}>
          {loading ? "Finding…" : "Find league"}
        </Button>
      </div>

      {error && (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--reach)" }}>{error}</div>
      )}

      {league && status && (
        <Card
          title="League detected"
          style={{ width: "100%", maxWidth: 480 }}
          action={<Tag tone={status.tone}>{status.label}</Tag>}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontStretch: "125%",
              fontWeight: 850,
              fontSize: 20,
            }}
          >
            {league.name}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <Tag>{league.teams} teams</Tag>
            <Tag>{league.scoring}</Tag>
            {league.superflex && <Tag>Superflex</Tag>}
            <Tag>Season {league.season}</Tag>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 12, flexWrap: "wrap" }}>
            {league.rosterPositions.map((p, i) => (
              <PositionBadge key={i} pos={toPosition(p)} size="sm" />
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <Button
              variant={league.status === "in_season" || league.status === "complete" ? "secondary" : "primary"}
              style={{ flex: 1 }}
              disabled={!league.draftId}
              onClick={() => router.push(`/league/${league.leagueId}/draft`)}
            >
              Draft room →
            </Button>
            <Button
              variant={league.status === "in_season" || league.status === "complete" ? "primary" : "secondary"}
              style={{ flex: 1 }}
              onClick={() => router.push(`/league/${league.leagueId}`)}
            >
              Dashboard →
            </Button>
          </div>
        </Card>
      )}

      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: "auto" }}>
        Data: Sleeper · nflverse · FantasyFootballCalculator · FantasyCalc · Boris Chen
      </div>
    </div>
  );
}
