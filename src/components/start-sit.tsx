"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { StatDelta } from "@/components/ui/stat-delta";
import { PositionBadge, type Position } from "@/components/ui/position-badge";
import { planLineup, expectedPoints, irMoves, PLAY_PROB, type LineupPlayer, type LineupPlan } from "@/lib/lineup";
import type { DashboardResponse, DashboardPlayer } from "@/app/api/league/[id]/dashboard/route";

const SLOT_LABEL: Record<string, string> = { SUPER_FLEX: "SFLX", WRRB_FLEX: "W/R", REC_FLEX: "W/T", FLEX: "FLEX" };

function kickoffLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}
function inactivesLabel(iso: string): string {
  return new Date(new Date(iso).getTime() - 90 * 60000).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
export function agoShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

const injuryTone = (s: string | null | undefined) => (s === "Q" ? "warn" : "reach") as "warn" | "reach";

function GameLine({ p }: { p: DashboardPlayer }) {
  if (p.onBye) return <span style={{ color: "var(--reach)" }}>BYE</span>;
  if (!p.game) return <span>{p.team ?? "FA"}</span>;
  return (
    <span>
      {p.team} {p.game.home ? "vs" : "@"} {p.game.opp} · {p.locked ? (p.game.state === "post" ? "final" : "live — locked") : kickoffLabel(p.game.kickoff)}
    </span>
  );
}

export function useLineupPlan(data: DashboardResponse, roster: DashboardResponse["rosters"][number] | null): LineupPlan | null {
  return React.useMemo(() => {
    if (!roster) return null;
    const byId: Record<string, LineupPlayer> = {};
    for (const pid of roster.players) {
      const p = data.playersById[pid];
      if (!p) continue;
      byId[pid] = { id: pid, pos: p.pos, proj: p.proj, injury: p.injury, onBye: !!p.onBye, locked: !!p.locked };
    }
    const active = roster.players.filter((pid) => !roster.reserve.includes(pid));
    return planLineup(data.league.rosterPositions, roster.starters, active, byId);
  }, [data, roster]);
}

export function StartSit({
  data,
  roster,
  isMobile,
  refreshing,
  onRefresh,
  aiFlags,
  side,
}: {
  data: DashboardResponse;
  roster: DashboardResponse["rosters"][number] | null;
  isMobile: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  /** AI read + draft recap, rendered under the decision cards. */
  aiFlags?: React.ReactNode;
  side?: React.ReactNode;
}) {
  const plan = useLineupPlan(data, roster);
  const player = (pid: string): DashboardPlayer =>
    data.playersById[pid] ?? { id: pid, name: pid, team: null, pos: "BN", injury: null, bye: null, proj: null, value: null };
  const exp = (pid: string) => {
    const p = player(pid);
    return expectedPoints({ id: pid, pos: p.pos, proj: p.proj, injury: p.injury, onBye: !!p.onBye });
  };

  if (!roster || !plan) {
    return (
      <Card title="Start / sit">
        <span style={{ fontSize: 13, color: "var(--text-faint)" }}>Pick your team to see your optimal lineup.</span>
      </Card>
    );
  }

  const isCurrentWeek = data.week === data.currentWeek;
  const injured = roster.players
    .map(player)
    .filter((p) => p.injury)
    .sort((a, b) => (PLAY_PROB[a.injury!] ?? 1) - (PLAY_PROB[b.injury!] ?? 1));
  const starterSet = new Set(roster.starters);
  const reserveSet = new Set(roster.reserve);
  // IR-slot players aren't bench: they can't start and don't use a bench spot.
  const bench = roster.players
    .filter((pid) => !starterSet.has(pid) && !reserveSet.has(pid))
    .map(player)
    .sort((a, b) => exp(b.id) - exp(a.id));
  const irSlot = roster.reserve.map(player);
  const rules = data.league.reserveRules;
  const ir = rules ? irMoves(roster.players, roster.reserve, (id) => data.playersById[id]?.injury, rules) : [];

  const slotsCard = (
    <Card
      title={`Lineup — ${data.league.scoring}, week ${data.week}`}
      pad={false}
      action={
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
          set {plan.currentTotal.toFixed(1)} · best{" "}
          <b style={{ color: plan.gain > 0 ? "var(--value)" : "var(--text-body)" }}>{plan.optimalTotal.toFixed(1)}</b>
        </span>
      }
    >
      {plan.slots.map((s, i) => {
        const cur = s.current ? player(s.current) : null;
        const change = s.optimal && s.optimal !== s.current ? player(s.optimal) : null;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderBottom: "1px solid var(--line-1)",
              minHeight: 48,
              borderLeft: "2px solid " + (change ? "var(--accent)" : "transparent"),
            }}
          >
            <span style={{ width: 36, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", letterSpacing: ".06em" }}>
              {SLOT_LABEL[s.slot] ?? s.slot}
            </span>
            {cur ? (
              <>
                <PositionBadge pos={(cur.pos as Position) ?? "BN"} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cur.name}
                    </span>
                    {cur.injury && <Tag tone={injuryTone(cur.injury)}>{cur.injury}</Tag>}
                    {cur.locked && <Tag>LOCKED</Tag>}
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                    <GameLine p={cur} />
                  </span>
                  {change && (
                    <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 2 }}>
                      → start {change.name} ({s.optimalPts.toFixed(1)})
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, fontSize: 13, color: "var(--reach)" }}>
                Empty slot{change ? ` → start ${change.name} (${s.optimalPts.toFixed(1)})` : ""}
              </div>
            )}
            <span
              title={cur && cur.proj != null && cur.injury ? `Raw projection ${cur.proj.toFixed(1)} × ${PLAY_PROB[cur.injury] ?? 1} chance to play` : undefined}
              style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 14, color: s.currentPts === 0 && cur ? "var(--reach)" : undefined }}
            >
              {cur ? s.currentPts.toFixed(1) : "—"}
            </span>
          </div>
        );
      })}
    </Card>
  );

  const decisions = (
    <Card title="Start / sit calls">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--text-muted)" }}>
        {plan.moves.map((m, i) => (
          <div key={`m-${i}`}>
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
          const pivot = a.pivot ? player(a.pivot) : null;
          const pivotText = pivot ? ` Pivot: ${pivot.name} (${exp(pivot.id).toFixed(1)}).` : "";
          if (a.kind === "EMPTY")
            return (
              <div key={`a-${i}`}>
                <Tag tone="reach">EMPTY</Tag> Your {SLOT_LABEL[a.slot] ?? a.slot} slot is empty — it scores 0.
              </div>
            );
          if (a.kind === "BYE" || a.kind === "OUT")
            return (
              <div key={`a-${i}`}>
                <Tag tone="reach">{a.kind === "BYE" ? "BYE" : p?.injury ?? "OUT"}</Tag>{" "}
                <b style={{ color: "var(--text-body)" }}>{p?.name}</b> {a.kind === "BYE" ? "is on bye" : "won't play"} — that slot
                scores 0.{pivotText}
              </div>
            );
          return (
            <div key={`a-${i}`}>
              <Tag tone={a.kind === "Q" ? "warn" : "reach"}>{a.kind}</Tag> <b style={{ color: "var(--text-body)" }}>{p?.name}</b>
              {p?.injuryDetail ? ` (${p.injuryDetail.toLowerCase()})` : ""} — {a.kind === "Q" ? "plays ~80% of the time" : "plays ~20% of the time"}.
              {p?.game && !p.locked ? ` Inactives ~${inactivesLabel(p.game.kickoff)}; check then.` : ""}
              {pivotText}
            </div>
          );
        })}
        {ir.map((m) => (
          <div key={`ir-${m.playerId}`}>
            <Tag tone={m.kind === "ACTIVATE" ? "reach" : "accent"}>{m.kind === "ACTIVATE" ? "ACTIVATE" : "IR"}</Tag>{" "}
            <b style={{ color: "var(--text-body)" }}>{player(m.playerId).name}</b>{" "}
            {m.kind === "ACTIVATE"
              ? "is in an IR slot but no longer IR-eligible — Sleeper blocks your adds and trades until you move the player out."
              : m.kind === "TO_IR"
                ? `is ${player(m.playerId).injury} and eligible — move to an open IR slot to free a bench spot.`
                : `is IR-eligible but your ${rules?.slots ?? 0} IR slots are full.`}
          </div>
        ))}
        {!plan.moves.length && !plan.alerts.length && !ir.length && (
          <span style={{ color: "var(--text-faint)" }}>Lineup is optimal — nothing to change.</span>
        )}
        {aiFlags}
      </div>
    </Card>
  );

  const injuryCard = (
    <Card
      title="Injury report — your roster"
      action={
        isCurrentWeek ? (
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Checking…" : "⟳ Check now"}
          </Button>
        ) : undefined
      }
      pad={false}
    >
      {injured.map((p) => (
        <div key={p.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--line-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tag tone={injuryTone(p.injury)}>{p.injury}</Tag>
            <b style={{ fontSize: 13 }}>{p.name}</b>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {p.pos} · {starterSet.has(p.id) ? "starting" : roster.reserve.includes(p.id) ? "IR slot" : "bench"}
            </span>
          </div>
          {(p.injuryDetail || p.injuryComment) && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {p.injuryDetail && <span style={{ color: "var(--text-body)" }}>{p.injuryDetail}. </span>}
              {p.injuryComment}
              {p.injuryCommentAt && <span style={{ color: "var(--text-faint)" }}> · {agoShort(p.injuryCommentAt)}</span>}
            </div>
          )}
        </div>
      ))}
      {!injured.length && <div style={{ padding: 14, fontSize: 13, color: "var(--text-faint)" }}>Everyone&apos;s healthy.</div>}
      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-faint)" }}>
        Designations: Sleeper · notes: ESPN · updated {agoShort(data.injuriesAsOf)} (hourly; every 15 min in game windows)
      </div>
    </Card>
  );

  const benchCard = bench.length || irSlot.length ? (
    <Card title="Bench — expected pts" pad={false}>
      {bench.map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: "1px solid var(--line-1)" }}>
          <PositionBadge pos={(p.pos as Position) ?? "BN"} size="sm" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              {p.injury && <Tag tone={injuryTone(p.injury)}>{p.injury}</Tag>}
            </div>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              <GameLine p={p} />
            </span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>{exp(p.id).toFixed(1)}</span>
        </div>
      ))}
      {irSlot.length > 0 && (
        <>
          <div
            style={{
              padding: "8px 12px 4px",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: ".08em",
              color: "var(--text-faint)",
              borderBottom: "1px solid var(--line-1)",
            }}
          >
            IR SLOTS {roster.reserve.length}/{rules?.slots ?? roster.reserve.length} — DON&apos;T USE A BENCH SPOT
          </div>
          {irSlot.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: "1px solid var(--line-1)", opacity: 0.75 }}>
              <PositionBadge pos={(p.pos as Position) ?? "BN"} size="sm" />
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{p.name}</span>
              {p.injury ? <Tag tone={injuryTone(p.injury)}>{p.injury}</Tag> : <Tag tone="reach">HEALTHY</Tag>}
            </div>
          ))}
        </>
      )}
    </Card>
  ) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 14, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {isMobile && decisions}
        {slotsCard}
        {!isMobile && benchCard}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!isMobile && decisions}
        {injuryCard}
        {side}
        {isMobile && benchCard}
      </div>
    </div>
  );
}
