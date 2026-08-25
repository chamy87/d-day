"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { PositionBadge, toPosition } from "@/components/ui/position-badge";
import { Wordmark } from "@/components/wordmark";
import { Turnstile } from "@/components/turnstile";
import { AccountButton, RecentLeagues } from "@/components/account";
import type { LeagueSummary } from "@/app/api/league/[id]/route";

const STATUS_TAG: Record<string, { tone: "accent" | "value" | "neutral"; label: string }> = {
  drafting: { tone: "accent", label: "DRAFTING" },
  pre_draft: { tone: "neutral", label: "PRE-DRAFT" },
  in_season: { tone: "value", label: "IN SEASON" },
  complete: { tone: "neutral", label: "COMPLETE" },
};

export function Landing({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const router = useRouter();
  const [id, setId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [league, setLeague] = React.useState<LeagueSummary | null>(null);
  const [mock, setMock] = React.useState<{
    draftId: string;
    name: string;
    teams: number;
    rounds: number | null;
    scoringType: string;
    status: string;
  } | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const resetTurnstile = React.useRef<(() => void) | null>(null);
  const onToken = React.useCallback((t: string | null) => setToken(t), []);

  const verifying = !!turnstileSiteKey && !token;
  const [slowVerify, setSlowVerify] = React.useState(false);
  React.useEffect(() => {
    if (!verifying) return;
    const t = setTimeout(() => setSlowVerify(true), 12000);
    return () => clearTimeout(t);
  }, [verifying]);
  const showSlowHint = slowVerify && verifying;

  const lookup = async () => {
    const trimmed = id.trim();
    if (!trimmed || loading || verifying) return;
    setLoading(true);
    setError(null);
    setLeague(null);
    setMock(null);
    try {
      const res = await fetch(`/api/league/${encodeURIComponent(trimmed)}`, {
        headers: token ? { "x-turnstile-token": token } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setLeague(data as LeagueSummary);
      } else if (res.status === 404) {
        // Not a league — maybe a mock draft id.
        const dres = await fetch(`/api/draft/${encodeURIComponent(trimmed)}/picks`);
        if (dres.ok) {
          const d = (await dres.json()) as {
            draft: {
              draft_id: string;
              status: string;
              metadata?: { name?: string; scoring_type?: string } | null;
              settings: { teams: number; rounds?: number };
            };
          };
          setMock({
            draftId: d.draft.draft_id,
            name: d.draft.metadata?.name || "Mock draft",
            teams: d.draft.settings.teams,
            rounds: d.draft.settings.rounds ?? null,
            scoringType: (d.draft.metadata?.scoring_type ?? "ppr").replace("_", " "),
            status: d.draft.status,
          });
        } else {
          setError("No league or mock draft found with that ID.");
        }
      } else {
        setError(data.error ?? "Lookup failed — try again.");
      }
    } catch {
      setError("Lookup failed — try again.");
    } finally {
      setLoading(false);
      resetTurnstile.current?.(); // tokens are single-use
    }
  };

  const status = league ? (STATUS_TAG[league.status] ?? STATUS_TAG.pre_draft) : null;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", padding: "12px 16px" }}>
        <span style={{ flex: 1 }} />
        <AccountButton />
      </header>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 24px 48px",
          gap: 28,
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
          Paste your Sleeper league ID (or a mock draft ID) — or pick up where you left off.
          No login required — rankings tuned to your league&apos;s exact scoring and roster.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Input
            label="Sleeper league ID"
            mono
            size="lg"
            placeholder="992093874321055744"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Button variant="primary" size="lg" onClick={lookup} disabled={loading || verifying}>
            {loading ? "Finding…" : verifying ? "Verifying…" : "Find league"}
          </Button>
        </div>
        {turnstileSiteKey && (
          <Turnstile siteKey={turnstileSiteKey} onToken={onToken} resetRef={resetTurnstile} />
        )}
        {showSlowHint && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
            Human check hasn&apos;t loaded — an ad blocker may be in the way. Reload to retry.
          </div>
        )}
      </div>

      {error && (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--reach)" }}>{error}</div>
      )}

      {mock && (
        <Card
          title="Mock draft detected"
          style={{ width: "100%", maxWidth: 480 }}
          action={<Tag tone={mock.status === "drafting" ? "accent" : "neutral"}>{mock.status.replace("_", "-").toUpperCase()}</Tag>}
        >
          <div style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 850, fontSize: 20 }}>
            {mock.name}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <Tag>{mock.teams} teams</Tag>
            <Tag>{mock.scoringType}</Tag>
            {mock.rounds && <Tag>{mock.rounds} rounds</Tag>}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" style={{ width: "100%" }} onClick={() => router.push(`/draft/${mock.draftId}`)}>
              Enter mock draft room →
            </Button>
          </div>
        </Card>
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

      <RecentLeagues />
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-faint)", padding: "0 0 14px" }}>
        Data: Sleeper · nflverse · FantasyFootballCalculator · FantasyCalc · Boris Chen
      </div>
    </div>
  );
}
