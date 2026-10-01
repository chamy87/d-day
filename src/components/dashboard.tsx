"use client";

import React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Tabs } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Toast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { PositionBadge, type Position } from "@/components/ui/position-badge";
import { Wordmark } from "@/components/wordmark";
import { useIsMobile } from "@/lib/use-mobile";
import { loadTeamPref, saveTeamPref } from "@/lib/session-client";
import { AdvisorTab, type TradePreset } from "@/components/advisor";
import { StartSit } from "@/components/start-sit";
import { useNeeds, useGamePlan, RosterBalance, WaiverIdeas, TradeIdeas, StashCard, NeedsLoading } from "@/components/roster-needs";
import { GamePlanTab } from "@/components/game-plan";
import { TeamPickerModal, TeamChip } from "@/components/team-picker-modal";
import { GlossaryButton } from "@/components/glossary";
import { AccountButton } from "@/components/account";
import { authFetch } from "@/lib/auth-client";
import type { HistoryItem } from "@/app/api/history/route";
import { useRouter } from "next/navigation";
import type { DashboardResponse, DashboardPlayer } from "@/app/api/league/[id]/dashboard/route";
import type { Insight } from "@/app/api/league/[id]/insights/route";

const TABS = ["GAME PLAN", "START/SIT", "MATCHUP", "WAIVERS", "TRADES", "NEWS"];

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
  const router = useRouter();
  const isMobile = useIsMobile();
  const [tab, setTab] = React.useState("GAME PLAN");
  const [week, setWeek] = React.useState<number | null>(null);
  const [myUserId, setMyUserId] = React.useState("");
  const [prefsLoaded, setPrefsLoaded] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerDismissed, setPickerDismissed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    loadTeamPref(leagueId).then((stored) => {
      if (cancelled) return;
      if (stored) setMyUserId(stored);
      setPrefsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);
  const chooseTeam = (id: string) => {
    setMyUserId(id);
    saveTeamPref(leagueId, id);
    setPickerOpen(false);
  };

  const queryClient = useQueryClient();
  const dash = useQuery({
    queryKey: ["dashboard", leagueId, week],
    queryFn: () => getJson<DashboardResponse>(`/api/league/${leagueId}/dashboard${week ? `?week=${week}` : ""}`),
    staleTime: 60 * 1000,
  });
  // On-demand injury check: server accepts ≤5-min-old designations instead of 1h.
  const freshCheck = useMutation({
    mutationFn: () =>
      getJson<DashboardResponse>(`/api/league/${leagueId}/dashboard?fresh=1${week ? `&week=${week}` : ""}`),
    onSuccess: (d) => queryClient.setQueryData(["dashboard", leagueId, week], d),
  });
  const [tradePreset, setTradePreset] = React.useState<{ key: number; preset: TradePreset } | null>(null);

  const data = dash.data;
  const myRoster = data?.rosters.find((r) => r.ownerId === myUserId) ?? null;
  const myTeamLabel = data?.users.find((u) => u.userId === myUserId)
    ? (data.users.find((u) => u.userId === myUserId)!.teamName ?? data.users.find((u) => u.userId === myUserId)!.name)
    : null;

  const recap = useQuery({
    queryKey: ["recap", leagueId],
    queryFn: async () => {
      const res = await authFetch(`/api/history?league=${encodeURIComponent(leagueId)}&kind=draft_recap&limit=1`);
      const d = (await res.json()) as { items?: HistoryItem[] };
      return d.items?.[0] ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });

  const needs = useNeeds(leagueId, myRoster?.rosterId ?? null, tab === "GAME PLAN" || tab === "WAIVERS" || tab === "TRADES");
  // Shares the cache with the GAME PLAN tab; only fetched once that tab asked for it.
  const gamePlan = useGamePlan(leagueId, myRoster?.rosterId ?? null, false);
  const loadTrade = (partner: number, myGives: string[], theyGive: string) => {
    if (!myRoster) return;
    setTradePreset({
      key: (tradePreset?.key ?? 0) + 1,
      preset: {
        teamB: partner,
        sends: {
          [myRoster.rosterId]: myGives.map((playerId) => ({ playerId, toRosterId: partner })),
          [partner]: [{ playerId: theyGive, toRosterId: myRoster.rosterId }],
        },
      },
    });
    setTab("TRADES");
  };

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

  const myMatchup = data.matchups.find((m) => m.rosterId === myRoster?.rosterId);
  const oppMatchup =
    myMatchup?.matchupId != null
      ? data.matchups.find((m) => m.matchupId === myMatchup.matchupId && m.rosterId !== myMatchup.rosterId)
      : undefined;
  const oppRoster = data.rosters.find((r) => r.rosterId === oppMatchup?.rosterId);
  const projTotal = (starters: string[] | undefined) =>
    Math.round((starters ?? []).filter((s) => s && s !== "0").reduce((sum, pid) => sum + (player(pid).proj ?? 0), 0) * 10) / 10;

  // News relevance: player-id match when the item carries ingest-time tags;
  // full-name match only as fallback (surname-only matching misfires).
  const myIds = new Set(myRoster?.players ?? []);
  const myNames = new Set((myRoster?.players ?? []).map((pid) => player(pid).name.toLowerCase()));
  const newsItems = myRoster
    ? data.news.filter((n) => {
        if (n.playerIds?.length) return n.playerIds.some((pid) => myIds.has(pid));
        const t = n.title.toLowerCase();
        return Array.from(myNames).some((name) => name.length > 5 && t.includes(name));
      })
    : data.news;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {isMobile ? (
        // Mobile: identity + actions on one line, tabs full-width and swipeable below.
        <header
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "8px 12px",
            borderBottom: "1px solid var(--line-1)",
            background: "var(--surface-panel)",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Link href="/" title="Home — look up another league" style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}>
              <Wordmark size={18} />
            </Link>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {data.league.name} · Wk {data.week} · {data.league.scoring}
            </span>
            {data.league.draftId && (
              <Link
                href={`/league/${leagueId}/draft`}
                style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", flexShrink: 0 }}
              >
                Board
              </Link>
            )}
            <span style={{ flexShrink: 0, maxWidth: 120, overflow: "hidden" }}>
              {myTeamLabel ? (
          <TeamChip label={myTeamLabel} onClick={() => setPickerOpen(true)} />
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            style={{
              background: "transparent",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-pill)",
              padding: "4px 12px",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 11,
              fontFamily: "var(--font-body)",
              whiteSpace: "nowrap",
            }}
          >
            Pick team
          </button>
        )}
            </span>
            <GlossaryButton />
            <AccountButton leagueId={leagueId} />
          </div>
          <Tabs items={TABS} value={tab} onChange={setTab} size="sm" style={{ display: "flex", width: "100%" }} />
        </header>
      ) : (
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
          {data.league.draftId && (
            <Tabs
              size="sm"
              items={["BOARD", "DASHBOARD"]}
              value="DASHBOARD"
              onChange={(v) => v === "BOARD" && router.push(`/league/${leagueId}/draft`)}
            />
          )}
          {myTeamLabel ? (
            <TeamChip label={myTeamLabel} onClick={() => setPickerOpen(true)} />
          ) : (
            <button
              onClick={() => setPickerOpen(true)}
              style={{
                background: "transparent",
                border: "1px solid var(--line-2)",
                borderRadius: "var(--radius-pill)",
                padding: "4px 12px",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: 11,
                fontFamily: "var(--font-body)",
              }}
            >
              Pick team
            </button>
          )}
          <GlossaryButton />
          <AccountButton leagueId={leagueId} />
        </header>
      )}

      {(pickerOpen || (prefsLoaded && !myUserId && !pickerDismissed && data.users.length > 0)) && (
        <TeamPickerModal
          options={data.users.map((u) => {
            const r = data.rosters.find((x) => x.ownerId === u.userId);
            return { value: u.userId, label: u.teamName ?? u.name, slot: r?.rosterId ?? null };
          })}
          onPick={chooseTeam}
          onSkip={() => {
            setPickerDismissed(true);
            setPickerOpen(false);
          }}
        />
      )}

      <div style={{ padding: isMobile ? 10 : 14, flex: 1, minWidth: 0 }}>
        {(tab === "START/SIT" || tab === "MATCHUP") && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <Select
              options={Array.from({ length: data.currentWeek }, (_, i) => ({
                value: String(i + 1),
                label: `Week ${i + 1}`,
              }))}
              value={String(data.week)}
              onChange={(e) => setWeek(Number(e.target.value))}
              style={{ width: 110 }}
            />
          </div>
        )}
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

        {tab === "GAME PLAN" && (
          <GamePlanTab
            leagueId={leagueId}
            data={data}
            roster={myRoster}
            needs={needs}
            isMobile={isMobile}
            onTab={setTab}
            onLoadTrade={loadTrade}
          />
        )}

        {tab === "START/SIT" && (
          <StartSit
            data={data}
            roster={myRoster}
            isMobile={isMobile}
            refreshing={freshCheck.isPending}
            onRefresh={() => freshCheck.mutate()}
            aiFlags={
              <>
                {(insights.isFetching || (insights.data?.insights ?? []).length > 0) && (
                  <div
                    style={{
                      borderTop: "1px solid var(--line-1)",
                      paddingTop: 8,
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: ".08em",
                      color: "var(--text-faint)",
                    }}
                  >
                    AI READ — PRACTICE REPORTS &amp; CONTEXT
                  </div>
                )}
                {insights.isFetching && <Skeleton height={40} />}
                {(insights.data?.insights ?? []).map((ins, i) => (
                  <div key={`ai-${i}`}>
                    <Tag tone={ins.tone}>{ins.tag}</Tag> {ins.text}
                  </div>
                ))}
              </>
            }
            side={
              <>
              {recap.data && (
                <Card title={`Draft recap${(recap.data.payload as { season?: string }).season ? ` · ${(recap.data.payload as { season?: string }).season}` : ""}`}>
                  {(() => {
                    const p = recap.data.payload as {
                      grade?: string;
                      totalVbd?: number;
                      steal?: number;
                      bestPick?: { name: string; label: string };
                      biggestReach?: { name: string; label: string };
                    };
                    return (
                      <>
                        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline" }}>
                          {p.grade && (
                            <span
                              style={{
                                fontFamily: "var(--font-display)",
                                fontStretch: "125%",
                                fontWeight: 850,
                                fontSize: 34,
                                color: "var(--accent)",
                                lineHeight: 1,
                              }}
                            >
                              {p.grade}
                            </span>
                          )}
                          {[
                            ["VALUE VS ADP", p.steal != null ? `+${p.steal}` : "—"],
                            ["VBD", p.totalVbd != null ? `+${p.totalVbd}` : "—"],
                            ["BEST PICK", p.bestPick ? `${p.bestPick.name} ${p.bestPick.label}` : "—"],
                            ["BIGGEST REACH", p.biggestReach ? `${p.biggestReach.name} ${p.biggestReach.label}` : "—"],
                          ].map(([l, v]) => (
                            <div key={l}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", color: "var(--text-faint)" }}>{l}</div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, marginTop: 2 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
                          Snapshotted when your draft completed. Full pick-by-pick grades live in the draft room.
                        </div>
                      </>
                    );
                  })()}
                </Card>
              )}
              </>
            }
          />
        )}

        {tab === "MATCHUP" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)",
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) 380px", gap: 14, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              {!myRoster ? null : needs.isLoading ? (
                <NeedsLoading />
              ) : needs.isError ? (
                <Toast tone="reach" title="Roster analysis unavailable">
                  {needs.error instanceof Error ? needs.error.message : "Try again shortly."}
                </Toast>
              ) : needs.data ? (
                <>
                  <StashCard needs={needs.data} notes={gamePlan.data?.plan.stash} />
                  <WaiverIdeas needs={needs.data} />
                </>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              {needs.data && <RosterBalance needs={needs.data} />}
          <Card title="Trending adds — unrostered" pad={false}>
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
            </div>
          </div>
        )}

        {tab === "TRADES" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            {myRoster && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
                {needs.isLoading ? (
                  <NeedsLoading />
                ) : needs.isError ? (
                  <Toast tone="reach" title="Roster analysis unavailable">
                    {needs.error instanceof Error ? needs.error.message : "Try again shortly."}
                  </Toast>
                ) : needs.data ? (
                  <>
                    <TradeIdeas needs={needs.data} pitches={gamePlan.data?.plan.trades} onLoad={loadTrade} />
                    <RosterBalance needs={needs.data} />
                  </>
                ) : null}
              </div>
            )}
            <AdvisorTab
              key={tradePreset?.key ?? 0}
              leagueId={leagueId}
              data={data}
              myRosterId={myRoster?.rosterId ?? null}
              isMobile={isMobile}
              preset={tradePreset?.preset ?? null}
            />
          </div>
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
