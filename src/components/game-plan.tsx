"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StatDelta } from "@/components/ui/stat-delta";
import { useLineupPlan, agoShort } from "@/components/start-sit";
import { RosterBalance, TradeIdeas, StashCard, WaiverIdeas, NeedsLoading, useGamePlan } from "@/components/roster-needs";
import { irMoves } from "@/lib/lineup";
import type { DashboardResponse, DashboardPlayer } from "@/app/api/league/[id]/dashboard/route";
import type { NeedsResponse } from "@/app/api/league/[id]/needs/route";
import type { UseQueryResult } from "@tanstack/react-query";

/**
 * GAME PLAN — everything that needs a decision this week on one screen:
 * lineup calls, trades (with both sides' simulated impact and the pitch),
 * stashes, waivers, IR. Numbers are deterministic; the AI writes the words.
 */
export function GamePlanTab({
  leagueId,
  data,
  roster,
  needs,
  isMobile,
  onTab,
  onLoadTrade,
}: {
  leagueId: string;
  data: DashboardResponse;
  roster: DashboardResponse["rosters"][number] | null;
  needs: UseQueryResult<NeedsResponse>;
  isMobile: boolean;
  onTab: (tab: string) => void;
  onLoadTrade: (partner: number, myGives: string[], theyGive: string) => void;
}) {
  const plan = useLineupPlan(data, roster);
  const ai = useGamePlan(leagueId, roster?.rosterId ?? null, true);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  if (!roster || !plan) {
    return (
      <Toast tone="accent" title="Pick your team">
        Choose your team above to get your weekly game plan.
      </Toast>
    );
  }

  const player = (pid: string): DashboardPlayer =>
    data.playersById[pid] ?? { id: pid, name: pid, team: null, pos: "BN", injury: null, bye: null, proj: null, value: null };
  const rules = data.league.reserveRules;
  const ir = rules ? irMoves(roster.players, roster.reserve, (id) => data.playersById[id]?.injury, rules) : [];

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/league/${leagueId}/gameplan?roster=${roster.rosterId}&refresh=1`);
      const d = await res.json();
      if (res.ok) qc.setQueryData(["gameplan", leagueId, roster.rosterId], d);
    } finally {
      setRefreshing(false);
    }
  };

  const headline = (
    <Card
      glow
      title={`Week ${data.week} game plan`}
      action={
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ai.data && (
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              AI {agoShort(ai.data.generatedAt)}
              {ai.data.model ? ` · ${ai.data.model}` : ""}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing || ai.isFetching}>
            {refreshing ? "Rethinking…" : "⟳ Refresh"}
          </Button>
        </span>
      }
    >
      {ai.isFetching && !ai.data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={26} width="80%" />
          <Skeleton height={16} />
          <Skeleton height={16} width="60%" />
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Reading your roster, the league and this week&apos;s news…</span>
        </div>
      ) : ai.isError ? (
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {ai.error instanceof Error ? ai.error.message : "AI unavailable."} The numbers below still stand.
        </span>
      ) : ai.data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, lineHeight: 1.3 }}>{ai.data.plan.headline}</div>
          {[
            ["LINEUP", ai.data.plan.lineup],
            ["WAIVERS", ai.data.plan.waivers],
            ["WATCH", ai.data.plan.watch],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} style={{ fontSize: 13, color: "var(--text-muted)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", color: "var(--text-faint)", marginRight: 6 }}>
                  {k}
                </span>
                {v}
              </div>
            ))}
        </div>
      ) : null}
    </Card>
  );

  const thisWeek = (
    <Card
      title="This week — lineup"
      action={
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
          set {plan.currentTotal.toFixed(1)} · best{" "}
          <b style={{ color: plan.gain > 0 ? "var(--value)" : "var(--text-body)" }}>{plan.optimalTotal.toFixed(1)}</b>
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
        {plan.moves.map((m, i) => (
          <div key={i}>
            <Tag tone="value">START</Tag> <b style={{ color: "var(--text-body)" }}>{player(m.start).name}</b>
            {m.bench ? (
              <>
                {" "}
                over <b style={{ color: "var(--text-body)" }}>{player(m.bench).name}</b>
              </>
            ) : (
              " in the empty slot"
            )}{" "}
            <StatDelta value={m.gain} label="pts" />
          </div>
        ))}
        {plan.alerts.map((a, i) => {
          const p = a.playerId ? player(a.playerId) : null;
          return (
            <div key={`a-${i}`}>
              <Tag tone={a.kind === "Q" ? "warn" : "reach"}>{a.kind === "OUT" ? (p?.injury ?? "OUT") : a.kind}</Tag>{" "}
              {p ? <b style={{ color: "var(--text-body)" }}>{p.name}</b> : `${a.slot} slot empty`}
              {p?.injuryDetail ? ` (${p.injuryDetail.toLowerCase()})` : ""}
              {a.pivot ? ` — pivot ${player(a.pivot).name}` : ""}
            </div>
          );
        })}
        {ir.map((m) => (
          <div key={m.playerId}>
            <Tag tone={m.kind === "ACTIVATE" ? "reach" : "accent"}>{m.kind === "ACTIVATE" ? "ACTIVATE" : "IR"}</Tag>{" "}
            <b style={{ color: "var(--text-body)" }}>{player(m.playerId).name}</b>{" "}
            {m.kind === "ACTIVATE" ? "— no longer IR-eligible; move out of the IR slot" : m.kind === "TO_IR" ? "— move to an open IR slot" : "— IR-eligible, slots full"}
          </div>
        ))}
        {!plan.moves.length && !plan.alerts.length && !ir.length && <span>Lineup is optimal — nothing to change.</span>}
        <div>
          <Button size="sm" variant="ghost" onClick={() => onTab("START/SIT")}>
            Full lineup &amp; injury report →
          </Button>
        </div>
      </div>
    </Card>
  );

  const n = needs.data;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {headline}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {thisWeek}
          {needs.isLoading ? (
            <NeedsLoading />
          ) : n ? (
            <TradeIdeas
              needs={n}
              limit={3}
              pitches={ai.data?.plan.trades}
              pitchesLoading={ai.isFetching}
              onLoad={onLoadTrade}
            />
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {n && <RosterBalance needs={n} />}
          {n && <StashCard needs={n} notes={ai.data?.plan.stash} />}
          {n && <WaiverIdeas needs={n} />}
          {needs.isError && (
            <Toast tone="reach" title="Roster analysis unavailable">
              {needs.error instanceof Error ? needs.error.message : "Try again shortly."}
            </Toast>
          )}
        </div>
      </div>
    </div>
  );
}
