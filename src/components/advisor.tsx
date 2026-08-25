"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-client";
import type { HistoryItem } from "@/app/api/history/route";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Toast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StatDelta } from "@/components/ui/stat-delta";
import { PositionBadge, type Position } from "@/components/ui/position-badge";
import type { DashboardResponse } from "@/app/api/league/[id]/dashboard/route";
import type { AdvisorAdvice, AdvisorPlayer } from "@/app/api/league/[id]/advisor/route";
import type { TradeEvaluation } from "@/app/api/league/[id]/trade/route";

type AdvisorResponse = { advice: AdvisorAdvice; myPlayers: AdvisorPlayer[]; cached?: boolean };

export function AdvisorTab({
  leagueId,
  data,
  myRosterId,
  isMobile,
}: {
  leagueId: string;
  data: DashboardResponse;
  myRosterId: number | null;
  isMobile: boolean;
}) {
  const [wanted, setWanted] = React.useState(false);
  const advisor = useQuery({
    queryKey: ["advisor", leagueId, myRosterId],
    queryFn: async () => {
      const res = await fetch(`/api/league/${leagueId}/advisor?roster=${myRosterId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Advisor unavailable.");
      return d as AdvisorResponse;
    },
    enabled: wanted && myRosterId != null,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const teamNameOf = (rosterId: number) => {
    const r = data.rosters.find((x) => x.rosterId === rosterId);
    const u = data.users.find((x) => x.userId === r?.ownerId);
    return u?.teamName ?? u?.name ?? `Team ${rosterId}`;
  };

  // ── Trade builder state ────────────────────────────────────────────────
  const otherRosters = data.rosters.filter((r) => r.rosterId !== myRosterId);
  const [teamB, setTeamB] = React.useState<number | null>(null);
  const [teamC, setTeamC] = React.useState<number | null>(null);
  const [sends, setSends] = React.useState<Record<number, { playerId: string; toRosterId: number }[]>>({});
  const involved = [myRosterId, teamB, teamC].filter((x): x is number => x != null);

  const toggleSend = (fromRoster: number, playerId: string) => {
    setSends((prev) => {
      const cur = prev[fromRoster] ?? [];
      if (cur.some((s) => s.playerId === playerId)) {
        return { ...prev, [fromRoster]: cur.filter((s) => s.playerId !== playerId) };
      }
      const defaultTo = involved.find((r) => r !== fromRoster);
      if (defaultTo == null) return prev;
      return { ...prev, [fromRoster]: [...cur, { playerId, toRosterId: defaultTo }] };
    });
  };
  const setRecipient = (fromRoster: number, playerId: string, toRosterId: number) => {
    setSends((prev) => ({
      ...prev,
      [fromRoster]: (prev[fromRoster] ?? []).map((s) => (s.playerId === playerId ? { ...s, toRosterId } : s)),
    }));
  };

  const queryClient = useQueryClient();
  const [viewedPast, setViewedPast] = React.useState<TradeEvaluation | null>(null);
  const evaluate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/league/${leagueId}/trade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teams: involved.map((rosterId) => ({ rosterId, sends: sends[rosterId] ?? [] })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Evaluation failed.");
      return d as TradeEvaluation;
    },
    onSuccess: (result) => {
      setViewedPast(null);
      // Durable history, fire-and-forget (proposals/ACCOUNTS-HISTORY.md item 4).
      authFetch("/api/history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leagueId,
          kind: "trade_eval",
          payload: { ...result, myRosterId },
        }),
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ["tradeHistory", leagueId] }))
        .catch(() => {});
    },
  });

  const pastEvals = useQuery({
    queryKey: ["tradeHistory", leagueId],
    queryFn: async () => {
      const res = await authFetch(`/api/history?league=${encodeURIComponent(leagueId)}&kind=trade_eval&limit=8`);
      const d = (await res.json()) as { items?: HistoryItem[] };
      return d.items ?? [];
    },
    staleTime: 60 * 1000,
  });

  const totalSent = involved.reduce((n, r) => n + (sends[r]?.length ?? 0), 0);
  const everySideSends = involved.every((r) => (sends[r]?.length ?? 0) > 0);

  const valueOf = (pid: string) => data.playersById[pid]?.value ?? 0;

  const rosterList = (rosterId: number) => {
    const roster = data.rosters.find((r) => r.rosterId === rosterId);
    const selected = sends[rosterId] ?? [];
    return (
      <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--line-1)", borderRadius: "var(--radius-sm)" }}>
        {(roster?.players ?? []).map((pid) => {
          const p = data.playersById[pid];
          if (!p) return null;
          const sel = selected.find((s) => s.playerId === pid);
          return (
            <div
              key={pid}
              role="checkbox"
              aria-checked={!!sel}
              tabIndex={0}
              onClick={() => toggleSend(rosterId, pid)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  toggleSend(rosterId, pid);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                minHeight: 40,
                borderBottom: "1px solid var(--line-1)",
                borderLeft: "2px solid " + (sel ? "var(--accent)" : "transparent"),
                cursor: "pointer",
                background: sel ? "var(--accent-dim)" : "transparent",
                transition: "background var(--dur-fast)",
              }}
            >
              <PositionBadge pos={(p.pos as Position) ?? "BN"} size="sm" />
              <span style={{ fontSize: 13, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </span>
              {p.value != null && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: sel ? "var(--accent)" : "var(--text-faint)" }}>
                  {p.value.toLocaleString()}
                </span>
              )}
              {sel && involved.length > 2 && (
                <span onClick={(e) => e.stopPropagation()}>
                  <Select
                    options={involved
                      .filter((r) => r !== rosterId)
                      .map((r) => ({ value: String(r), label: `→ ${teamNameOf(r)}` }))}
                    value={String(sel.toRosterId)}
                    onChange={(e) => setRecipient(rosterId, pid, Number(e.target.value))}
                    style={{ width: 140 }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Pre-evaluation value balance per side (item 7): fairness at a glance.
  const balance = involved.map((r) => {
    const out = (sends[r] ?? []).reduce((n, s) => n + valueOf(s.playerId), 0);
    const inn = involved
      .flatMap((o) => sends[o] ?? [])
      .filter((s) => s.toRosterId === r)
      .reduce((n, s) => n + valueOf(s.playerId), 0);
    return { rosterId: r, out, inn, delta: inn - out };
  });
  const maxSide = Math.max(1, ...balance.flatMap((b) => [b.out, b.inn]));

  if (myRosterId == null) {
    return (
      <Toast tone="accent" title="Pick your team">
        Choose your team above to unlock the advisor and trade builder.
      </Toast>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, alignItems: "start" }}>
      <Card
        title="Sell high / buy low"
        action={
          advisor.data ? (
            <Button variant="ghost" size="sm" onClick={() => advisor.refetch()}>
              Refresh
            </Button>
          ) : undefined
        }
      >
        {!wanted && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              AI reads your roster&apos;s market values, 30-day trends, ages, tiers, projections and this
              week&apos;s news — then names who to move and who to chase.
            </span>
            <Button variant="primary" onClick={() => setWanted(true)}>
              Analyze my roster
            </Button>
          </div>
        )}
        {advisor.isFetching && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={24} width="70%" />
          </div>
        )}
        {advisor.isError && (
          <span style={{ fontSize: 13, color: "var(--reach)" }}>
            {advisor.error instanceof Error ? advisor.error.message : "Advisor unavailable."}
          </span>
        )}
        {advisor.data && !advisor.isFetching && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, color: "var(--text-muted)" }}>
            {advisor.data.advice.sell.map((s, i) => (
              <div key={`s-${i}`}>
                <Tag tone="reach">SELL</Tag> <b style={{ color: "var(--text-body)" }}>{s.name}</b> — {s.reason}
              </div>
            ))}
            {advisor.data.advice.acquire.map((a, i) => (
              <div key={`a-${i}`}>
                <Tag tone="value">ACQUIRE</Tag> <b style={{ color: "var(--text-body)" }}>{a.name}</b>{" "}
                <span style={{ color: "var(--text-faint)" }}>({a.owner})</span> — {a.reason}
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 10 }}>{advisor.data.advice.summary}</div>
          </div>
        )}
      </Card>

      <Card title="Trade builder — 2 or 3 teams">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Select
              label="Trade with"
              options={[
                { value: "", label: "Pick a team…" },
                ...otherRosters.map((r) => ({ value: String(r.rosterId), label: teamNameOf(r.rosterId) })),
              ]}
              value={teamB != null ? String(teamB) : ""}
              onChange={(e) => {
                setTeamB(e.target.value ? Number(e.target.value) : null);
                setSends({});
                evaluate.reset();
              }}
              style={{ flex: 1, minWidth: 160 }}
            />
            <Select
              label="Third team (optional)"
              options={[
                { value: "", label: "None" },
                ...otherRosters
                  .filter((r) => r.rosterId !== teamB)
                  .map((r) => ({ value: String(r.rosterId), label: teamNameOf(r.rosterId) })),
              ]}
              value={teamC != null ? String(teamC) : ""}
              onChange={(e) => {
                setTeamC(e.target.value ? Number(e.target.value) : null);
                setSends({});
                evaluate.reset();
              }}
              style={{ flex: 1, minWidth: 160 }}
            />
          </div>

          {teamB != null &&
            involved.map((rosterId) => (
              <div key={rosterId}>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    letterSpacing: "var(--track-caps)",
                    textTransform: "uppercase",
                    color: "var(--text-faint)",
                    marginBottom: 6,
                  }}
                >
                  {teamNameOf(rosterId)} sends
                </div>
                {rosterList(rosterId)}
              </div>
            ))}

          {teamB != null && totalSent > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {balance.map((b) => (
                <div key={b.rosterId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-faint)", width: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {teamNameOf(b.rosterId)}
                  </span>
                  <div style={{ flex: 1, display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--bg-1)" }}>
                    <span style={{ width: `${(b.out / maxSide) * 50}%`, background: "var(--reach)", opacity: 0.7 }} />
                    <span style={{ width: `${(b.inn / maxSide) * 50}%`, background: "var(--value)", opacity: 0.7 }} />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      width: 60,
                      textAlign: "right",
                      color: b.delta > 0 ? "var(--value)" : b.delta < 0 ? "var(--reach)" : "var(--text-faint)",
                    }}
                  >
                    {b.delta >= 0 ? "+" : ""}
                    {b.delta.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {teamB != null && (
            <Button
              variant="primary"
              disabled={!everySideSends || totalSent < 2 || evaluate.isPending}
              onClick={() => evaluate.mutate()}
            >
              {evaluate.isPending ? "Evaluating…" : "Evaluate trade"}
            </Button>
          )}

          {evaluate.isError && (
            <span style={{ fontSize: 13, color: "var(--reach)" }}>
              {evaluate.error instanceof Error ? evaluate.error.message : "Evaluation failed."}
            </span>
          )}

          {(viewedPast ?? evaluate.data) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              {viewedPast && (
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Past evaluation (read-only)</div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Tag tone={(viewedPast ?? evaluate.data)!.realistic ? "value" : "reach"}>
                  {(viewedPast ?? evaluate.data)!.realistic ? "REALISTIC" : "UNREALISTIC"}
                </Tag>
                <Tag tone="neutral">{(viewedPast ?? evaluate.data)!.fairness}</Tag>
              </div>
              {(viewedPast ?? evaluate.data)!.teams.map((t) => (
                <div key={t.rosterId} style={{ borderTop: "1px solid var(--line-1)", paddingTop: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <b>{t.teamName}</b>
                    <StatDelta value={t.valueDelta} label="value" />
                  </div>
                  <div style={{ color: "var(--text-faint)", fontSize: 12, marginTop: 2 }}>
                    gives {t.gives.join(", ") || "—"} · receives {t.receives.join(", ") || "—"}
                  </div>
                  {t.benefit && <div style={{ color: "var(--text-muted)", marginTop: 4 }}>▲ {t.benefit}</div>}
                  {t.concerns && <div style={{ color: "var(--text-muted)" }}>▼ {t.concerns}</div>}
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 8, color: "var(--text-muted)" }}>
                <Tag tone="accent">ANGLE</Tag> {(viewedPast ?? evaluate.data)!.angle}
              </div>
              <div style={{ color: "var(--text-body)" }}>{(viewedPast ?? evaluate.data)!.summary}</div>
            </div>
          )}

          {(pastEvals.data?.length ?? 0) > 0 && (
            <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 10 }}>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  letterSpacing: "var(--track-caps)",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                  marginBottom: 8,
                }}
              >
                Past evaluations
              </div>
              {pastEvals.data!.map((h) => {
                const p = h.payload as unknown as TradeEvaluation & { myRosterId?: number };
                const mine = p.teams?.find((t) => t.rosterId === p.myRosterId) ?? p.teams?.[0];
                if (!mine) return null;
                return (
                  <div
                    key={h.id}
                    onClick={() => setViewedPast(p)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 4px",
                      borderBottom: "1px solid var(--line-1)",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", flexShrink: 0 }}>
                      {new Date(h.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                      {mine.gives.join(", ") || "—"} ⇄ {mine.receives.join(", ") || "—"}
                    </span>
                    <StatDelta value={mine.valueDelta} style={{ flexShrink: 0 }} />
                    <Tag tone={p.realistic ? "value" : "reach"}>{p.realistic ? "REALISTIC" : "UNREALISTIC"}</Tag>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
