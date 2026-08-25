"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Tabs } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Toast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { PositionBadge, type Position } from "@/components/ui/position-badge";
import { StatDelta } from "@/components/ui/stat-delta";
import { Wordmark } from "@/components/wordmark";
import { useIsMobile } from "@/lib/use-mobile";
import { loadTeamPref, saveTeamPref } from "@/lib/session-client";
import { AdvisorTab } from "@/components/advisor";
import type { DashboardResponse, DashboardPlayer } from "@/app/api/league/[id]/dashboard/route";
import type { Insight } from "@/app/api/league/[id]/insights/route";

const TABS = ["START/SIT", "MATCHUP", "WAIVERS", "ADVISOR", "NEWS"];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function PlayerLine({ p, right }: { p: DashboardPlayer; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderBottom: "1px solid var(--line-1)",
        minHeight: 44,
      }}
    >
      <PositionBadge pos={(p.pos as Position) ?? "BN"} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.name}
          </span>
          {p.injury && <Tag tone="reach">{p.injury}</Tag>}
        </div>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
          {p.team ?? "FA"}
          {p.bye != null ? " · BYE " + p.bye : ""}
        </span>
      </div>
      {right}
    </div>
  );
}

export function Dashboard({ leagueId }: { leagueId: string }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = React.useState("START/SIT");
  const [week, setWeek] = React.useState<number | null>(null);
  const [myUserId, setMyUserId] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    loadTeamPref(leagueId).then((stored) => {
      if (stored && !cancelled) setMyUserId(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);
  const chooseTeam = (id: string) => {
    setMyUserId(id);
    saveTeamPref(leagueId, id);
  };

  const dash = useQuery({
    queryKey: ["dashboard", leagueId, week],
    queryFn: () => getJson<DashboardResponse>(`/api/league/${leagueId}/dashboard${week ? `?week=${week}` : ""}`),
    staleTime: 60 * 1000,
  });

  const data = dash.data;
  const myRoster = data?.rosters.find((r) => r.ownerId === myUserId) ?? null;

  const insights = useQuery({
    queryKey: ["insights", leagueId, data?.week, myRoster?.rosterId],
    queryFn: () =>
      getJson<{ insights: Insight[]; reason?: string }>(
        `/api/league/${leagueId}/insights?week=${data!.week}&roster=${myRoster!.rosterId}`,
      ),
    enabled: !!data && !!myRoster,
    staleTime: 30 * 60 * 1000,
  });

  if (dash.isLoading) {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
        <Wordmark size={20} />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={44} />
        ))}
      </div>
    );
  }
  if (dash.isError || !data) {
    return (
      <div style={{ padding: 48, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
        <Wordmark size={28} />
        <Toast tone="reach" title="Dashboard unavailable">
          {dash.error instanceof Error ? dash.error.message : "Try again shortly."}
        </Toast>
      </div>
    );
  }

  const nameOfRoster = (rosterId: number | undefined) => {
    const r = data.rosters.find((x) => x.rosterId === rosterId);
    const u = data.users.find((x) => x.userId === r?.ownerId);
    return u?.teamName ?? u?.name ?? `Team ${rosterId ?? "?"}`;
  };
  const player = (pid: string): DashboardPlayer =>
    data.playersById[pid] ?? { id: pid, name: pid, team: null, pos: "BN", injury: null, bye: null, proj: null };

  const myStarters = (myRoster?.starters ?? []).filter((s) => s && s !== "0").map(player);
  const myBench = (myRoster?.players ?? [])
    .filter((pid) => !(myRoster?.starters ?? []).includes(pid))
    .map(player)
    .sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0));

  // Deterministic bench-over-starter flags (same position, ≥1 pt edge).
  const benchFlags = myStarters.flatMap((s) => {
    const better = myBench.find((b) => b.pos === s.pos && (b.proj ?? 0) > (s.proj ?? 0) + 1);
    return better
      ? [{ starter: s, bench: better, edge: Math.round(((better.proj ?? 0) - (s.proj ?? 0)) * 10) / 10 }]
      : [];
  });

  const myMatchup = data.matchups.find((m) => m.rosterId === myRoster?.rosterId);
  const oppMatchup =
    myMatchup?.matchupId != null
      ? data.matchups.find((m) => m.matchupId === myMatchup.matchupId && m.rosterId !== myMatchup.rosterId)
      : undefined;
  const oppRoster = data.rosters.find((r) => r.rosterId === oppMatchup?.rosterId);
  const projTotal = (starters: string[] | undefined) =>
    Math.round((starters ?? []).filter((s) => s && s !== "0").reduce((sum, pid) => sum + (player(pid).proj ?? 0), 0) * 10) / 10;

  const benchCard =
    myBench.length > 0 ? (
      <Card title="Bench" pad={false}>
        {myBench.map((p, i) => (
          <PlayerLine
            key={`${p.id}-${i}`}
            p={p}
            right={
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>
                {p.proj != null ? p.proj.toFixed(1) : "—"}
              </span>
            }
          />
        ))}
      </Card>
    ) : null;

  const myNames = new Set((myRoster?.players ?? []).map((pid) => player(pid).name.toLowerCase()));
  const newsItems = myRoster
    ? data.news.filter((n) => {
        const t = n.title.toLowerCase();
        return Array.from(myNames).some((name) => t.includes(name) || t.includes(name.split(" ").slice(-1)[0]));
      })
    : data.news;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 16px",
          borderBottom: "1px solid var(--line-1)",
          background: "var(--surface-panel)",
          flexWrap: "wrap",
        }}
      >
        <Link href="/" title="Home — look up another league" style={{ textDecoration: "none", color: "inherit" }}>
          <Wordmark size={20} />
        </Link>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {data.league.name} · Week {data.week}
        </span>
        <Tag>{data.league.scoring}</Tag>
        <span style={{ flex: 1 }} />
        <Tabs items={TABS} value={tab} onChange={setTab} size="sm" />
        <Select
          options={Array.from({ length: 18 }, (_, i) => ({ value: String(i + 1), label: `Week ${i + 1}` }))}
          value={String(data.week)}
          onChange={(e) => setWeek(Number(e.target.value))}
          style={{ width: 110 }}
        />
        <Select
          options={[
            { value: "", label: "Pick your team…" },
            ...data.users.map((u) => ({ value: u.userId, label: u.teamName ?? u.name })),
          ]}
          value={myUserId}
          onChange={(e) => chooseTeam(e.target.value)}
          style={{ width: 170 }}
        />
        {data.league.draftId && (
          <Link href={`/league/${leagueId}/draft`} style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Draft room →
          </Link>
        )}
      </header>

      <div style={{ padding: 14, flex: 1 }}>
        {data.degraded.length > 0 && (
          <Toast tone="warn" title="Degraded data" style={{ marginBottom: 14 }}>
            {data.degraded.join(", ")} unavailable — showing what&apos;s cached.
          </Toast>
        )}
        {!myRoster && (
          <Toast tone="accent" title="Pick your team" style={{ marginBottom: 14 }}>
            Choose your team above to unlock start/sit, matchup and filtered news.
          </Toast>
        )}

        {tab === "START/SIT" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
              gap: 14,
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14, order: isMobile ? 0 : undefined }}>
              <Card title={`Your starters — projected (${data.league.scoring})`} pad={false}>
                {myStarters.length ? (
                  myStarters.map((p, i) => (
                    <PlayerLine
                      key={`${p.id}-${i}`}
                      p={p}
                      right={
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 14 }}>
                          {p.proj != null ? p.proj.toFixed(1) : "—"}
                        </span>
                      }
                    />
                  ))
                ) : (
                  <div style={{ padding: 16, fontSize: 13, color: "var(--text-faint)" }}>
                    {myRoster ? "No starters set for this week." : "Pick your team to see starters."}
                  </div>
                )}
              </Card>
              {!isMobile && benchCard}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card title="Flags">
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--text-muted)" }}>
                  {benchFlags.map((f, i) => (
                    <div key={i}>
                      <Tag tone="reach">RISK</Tag>{" "}
                      <b style={{ color: "var(--text-body)" }}>{f.bench.name}</b> projects{" "}
                      <StatDelta value={f.edge} /> over your starting {f.starter.pos} {f.starter.name}.
                    </div>
                  ))}
                  {insights.isFetching && <Skeleton height={40} />}
                  {(insights.data?.insights ?? []).map((ins, i) => (
                    <div key={`ai-${i}`}>
                      <Tag tone={ins.tone}>{ins.tag}</Tag> {ins.text}
                    </div>
                  ))}
                  {!benchFlags.length && !insights.isFetching && !(insights.data?.insights ?? []).length && (
                    <span style={{ color: "var(--text-faint)" }}>
                      {myRoster ? "No flags — lineup looks set." : "Pick your team to get flags."}
                    </span>
                  )}
                </div>
              </Card>
              {isMobile && benchCard}
            </div>
          </div>
        )}

        {tab === "MATCHUP" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 14,
              alignItems: "start",
              maxWidth: 900,
            }}
          >
            {[
              { roster: myRoster, m: myMatchup, label: myRoster ? nameOfRoster(myRoster.rosterId) : "Your team" },
              { roster: oppRoster ?? null, m: oppMatchup, label: oppRoster ? nameOfRoster(oppRoster.rosterId) : "Opponent" },
            ].map((side, i) => (
              <Card
                key={i}
                title={side.label}
                pad={false}
                action={
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: i === 0 ? "var(--value)" : "var(--text-muted)" }}>
                    {side.m && side.m.points > 0 ? side.m.points.toFixed(1) : `proj ${projTotal(side.roster?.starters)}`}
                  </span>
                }
              >
                {(side.roster?.starters ?? []).filter((s) => s && s !== "0").map((pid, j) => {
                  const p = player(pid);
                  return (
                    <PlayerLine
                      key={`${pid}-${j}`}
                      p={p}
                      right={
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                          {p.proj != null ? p.proj.toFixed(1) : "—"}
                        </span>
                      }
                    />
                  );
                })}
                {!side.roster && (
                  <div style={{ padding: 16, fontSize: 13, color: "var(--text-faint)" }}>
                    {i === 0 ? "Pick your team above." : "No matchup this week."}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {tab === "WAIVERS" && (
          <Card title="Waiver targets — trending ∩ unrostered" pad={false} style={{ maxWidth: 640 }}>
            {data.waivers.map((w) => {
              const p = player(w.id);
              return (
                <PlayerLine
                  key={w.id}
                  p={p}
                  right={
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                        +{w.adds24h.toLocaleString()} adds
                      </span>
                      {w.value != null && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)" }}>
                          FC {w.value.toLocaleString()}
                        </span>
                      )}
                      <Tag tone="neutral">FAAB ${w.faab}</Tag>
                    </div>
                  }
                />
              );
            })}
            {!data.waivers.length && (
              <div style={{ padding: 16, fontSize: 13, color: "var(--text-faint)" }}>
                No trending unrostered players right now.
              </div>
            )}
          </Card>
        )}

        {tab === "ADVISOR" && (
          <AdvisorTab leagueId={leagueId} data={data} myRosterId={myRoster?.rosterId ?? null} isMobile={isMobile} />
        )}

        {tab === "NEWS" && (
          <Card title={myRoster ? "News — your players" : "News — league players"} pad={false} style={{ maxWidth: 640 }}>
            {newsItems.map((n) => (
              <div key={n.id} style={{ padding: "10px 12px", borderBottom: "1px solid var(--line-1)" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {n.url ? <a href={n.url} target="_blank" rel="noreferrer" style={{ color: "var(--text-body)" }}>{n.title}</a> : n.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                  {n.source}
                  {n.publishedAt ? ` · ${ago(n.publishedAt)}` : ""}
                </div>
              </div>
            ))}
            {!newsItems.length && (
              <div style={{ padding: 16, fontSize: 13, color: "var(--text-faint)" }}>
                Nothing relevant in the feeds right now.
              </div>
            )}
          </Card>
        )}
      </div>

      <footer style={{ fontSize: 11, color: "var(--text-faint)", padding: "8px 16px", borderTop: "1px solid var(--line-1)" }}>
        Data: Sleeper · nflverse · FantasyFootballCalculator · FantasyCalc · Boris Chen
      </footer>
    </div>
  );
}
