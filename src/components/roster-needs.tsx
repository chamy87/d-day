"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatDelta } from "@/components/ui/stat-delta";
import { PositionBadge, type Position } from "@/components/ui/position-badge";
import type { NeedsResponse } from "@/app/api/league/[id]/needs/route";
import type { GamePlanResponse } from "@/app/api/league/[id]/gameplan/route";
import type { RatedPlayer } from "@/lib/roster-needs";
import { agoShort } from "@/components/start-sit";

export function useNeeds(leagueId: string, rosterId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ["needs", leagueId, rosterId],
    queryFn: async () => {
      const res = await fetch(`/api/league/${leagueId}/needs?roster=${rosterId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Roster analysis unavailable.");
      return d as NeedsResponse;
    },
    enabled: enabled && rosterId != null,
    staleTime: 10 * 60 * 1000,
  });
}

const LABEL_TONE = { NEED: "reach", OK: "neutral", STRENGTH: "value" } as const;

function Caps({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", color: "var(--text-faint)", textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

function statLine(p: RatedPlayer) {
  const bits = [`${p.rate.toFixed(1)}/g rate`];
  if (p.ytdPpg != null) bits.push(`${p.ytdPpg.toFixed(1)} ppg in ${p.gp}g`);
  if (p.weekProj != null) bits.push(`wk proj ${p.weekProj.toFixed(1)}`);
  return bits.join(" · ");
}

export function RosterBalance({ needs }: { needs: NeedsResponse }) {
  const P = needs.players;
  const max = Math.max(1, ...needs.strength.flatMap((s) => [s.mine, s.leagueAvg]));
  return (
    <Card
      title="Roster balance vs league"
      action={<span style={{ fontSize: 11, color: "var(--text-faint)" }}>stats {agoShort(needs.asOf.stats)}</span>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {needs.strength.map((s) => (
          <div key={s.pos}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PositionBadge pos={s.pos as Position} size="sm" />
              <Tag tone={LABEL_TONE[s.label]}>{s.label}</Tag>
              {s.surplus.length > 0 && <Tag tone="accent">SURPLUS ×{s.surplus.length}</Tag>}
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                #{s.rank}/{s.teams}
              </span>
              <StatDelta value={s.gap} suffix="/g" />
            </div>
            <div style={{ position: "relative", height: 8, background: "var(--bg-1)", borderRadius: 4, marginTop: 6 }}>
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(s.mine / max) * 100}%`,
                  borderRadius: 4,
                  background: s.label === "NEED" ? "var(--reach)" : s.label === "STRENGTH" ? "var(--value)" : "var(--text-faint)",
                  opacity: 0.75,
                }}
              />
              <span
                title={`League average: ${s.leagueAvg}`}
                style={{ position: "absolute", left: `${(s.leagueAvg / max) * 100}%`, top: -3, bottom: -3, width: 2, background: "var(--text-body)" }}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
              Your top {s.slots} {s.pos}: {s.starters.map((x) => `${P[x.id]?.name ?? x.id} ${x.rate.toFixed(1)}`).join(", ") || "none"} ={" "}
              {s.mine.toFixed(1)}/g vs league avg {s.leagueAvg.toFixed(1)}
              {s.surplus.length > 0 && ` · tradeable depth: ${s.surplus.map((x) => P[x.id]?.name ?? x.id).join(", ")}`}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "var(--text-faint)", borderTop: "1px solid var(--line-1)", paddingTop: 8 }}>
          Rate = expected pts/game in your scoring: season actuals blended with 4 games of preseason projection, averaged with this
          week&apos;s projection. NEED = bottom third or ≥3/g below average. Bar tick = league average.
        </div>
      </div>
    </Card>
  );
}

export function WaiverIdeas({ needs }: { needs: NeedsResponse }) {
  const P = needs.players;
  const real = needs.waivers.filter((w) => w.gain > 0);
  const depth = needs.waivers.filter((w) => w.gain <= 0);
  return (
    <Card
      title="Best adds for your lineup"
      pad={false}
      action={
        needs.faab ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            FAAB ${needs.faab.remaining}/{needs.faab.budget}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>rolling waivers</span>
        )
      }
    >
      {real.map((w) => {
        const p = P[w.id];
        if (!p) return null;
        const drop = w.drop ? P[w.drop] : null;
        return (
          <div key={w.id} style={{ padding: "9px 12px", borderBottom: "1px solid var(--line-1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PositionBadge pos={p.pos as Position} size="sm" />
              <b style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name} <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-faint)" }}>{p.team}</span>
              </b>
              {p.injury && <Tag tone={p.injury === "Q" ? "warn" : "reach"}>{p.injury}</Tag>}
              {w.needPos && <Tag tone="reach">NEED</Tag>}
              <StatDelta value={w.gain} suffix="/g" />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3 }}>{statLine(p)}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              +{w.gain.toFixed(1)}/g × {needs.weeksLeft} wks ≈ <b style={{ color: "var(--text-body)" }}>+{w.seasonGain} pts</b>
              {w.bid != null && (
                <>
                  {" "}
                  ⇒ bid <b style={{ color: "var(--accent)" }}>${w.bid}</b> ({w.bidPct}% of remaining)
                </>
              )}
              {drop && <> · drop {drop.name} ({drop.rate.toFixed(1)}/g)</>}
            </div>
          </div>
        );
      })}
      {!real.length && needs.waivers.length > 0 && (
        <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-muted)", borderBottom: "1px solid var(--line-1)" }}>
          <b style={{ color: "var(--text-body)" }}>No free agent beats your current starters.</b> Don&apos;t spend FAAB yet — the
          upgrade path is a trade (see TRADES). Best depth for byes and injuries:
        </div>
      )}
      {depth.slice(0, 6).map((w) => {
        const p = P[w.id];
        if (!p) return null;
        return (
          <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "1px solid var(--line-1)" }}>
            <PositionBadge pos={p.pos as Position} size="sm" />
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name} <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-faint)" }}>{p.team}</span>
            </span>
            {p.injury && <Tag tone={p.injury === "Q" ? "warn" : "reach"}>{p.injury}</Tag>}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{statLine(p)}</span>
          </div>
        );
      })}
      {!real.length && depth[0]?.drop && P[depth[0].drop] && (
        <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--line-1)" }}>
          If you add one, your cut is {P[depth[0].drop].name} ({P[depth[0].drop].rate.toFixed(1)}/g, lowest-value non-starter).
        </div>
      )}
      {!needs.waivers.length && (
        <div style={{ padding: 14, fontSize: 13, color: "var(--text-faint)" }}>No free agent improves your lineup right now.</div>
      )}
      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-faint)" }}>
        Gain = how much your best possible lineup improves with the player added. FAAB: 1% of remaining budget per 4
        rest-of-season points, capped at 40%, +25% when 10k+ Sleeper users are adding them.
      </div>
    </Card>
  );
}

export function useGamePlan(leagueId: string, rosterId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ["gameplan", leagueId, rosterId],
    queryFn: async () => {
      const res = await fetch(`/api/league/${leagueId}/gameplan?roster=${rosterId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "AI game plan unavailable.");
      return d as GamePlanResponse;
    },
    enabled: enabled && rosterId != null,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "Copied" : "Copy pitch"}
    </Button>
  );
}

export function TradeIdeas({
  needs,
  onLoad,
  pitches,
  pitchesLoading,
  limit,
}: {
  needs: NeedsResponse;
  onLoad: (partnerRosterId: number, myGives: string[], theyGive: string) => void;
  /** AI case + pitch per target (from the game plan). */
  pitches?: GamePlanResponse["plan"]["trades"];
  pitchesLoading?: boolean;
  limit?: number;
}) {
  const P = needs.players;
  return (
    <Card title="Trade targets — both sides improve" pad={false}>
      {needs.trades.slice(0, limit ?? needs.trades.length).map((t, i) => {
        const target = P[t.target];
        if (!target) return null;
        const ai = pitches?.find((x) => x.targetId === t.target);
        return (
          <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid var(--line-1)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Tag tone="value">GET</Tag>
              <PositionBadge pos={target.pos as Position} size="sm" />
              <b style={{ fontSize: 14 }}>{target.name}</b>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>from {t.partner}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
              <Tag tone="reach">GIVE</Tag>
              {t.send.map((sid) => (
                <span key={sid} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <PositionBadge pos={(P[sid]?.pos as Position) ?? "BN"} size="sm" /> {P[sid]?.name ?? sid}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div>
                <Caps>You</Caps>
                <div>
                  <StatDelta value={t.myGain} suffix="/g" />
                </div>
              </div>
              <div>
                <Caps>Them</Caps>
                <div>
                  <StatDelta value={t.theirGain} suffix="/g" />
                </div>
              </div>
              <div>
                <Caps>Market</Caps>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {t.targetValue.toLocaleString()} for {t.sendValueAdj.toLocaleString()}
                  {t.send.length > 1 && <span style={{ color: "var(--text-faint)" }}> ({t.sendValue.toLocaleString()} raw)</span>}
                </div>
              </div>
              <div>
                <Caps>Max offer</Caps>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{t.maxValue.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {target.name}: {statLine(target)}
              {t.send.map((sid) => (P[sid] ? ` · ${P[sid].name}: ${P[sid].rate.toFixed(1)}/g` : "")).join("")}
            </div>
            {t.fit && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Why it works: {t.fit}.</div>}
            {ai?.case && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <Tag tone="value">YOUR CASE</Tag> {ai.case}
              </div>
            )}
            {ai?.pitch && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-body)",
                  background: "var(--bg-1)",
                  border: "1px solid var(--line-1)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Tag tone="accent">PITCH TO {t.partner.toUpperCase()}</Tag>
                  <span style={{ flex: 1 }} />
                  <CopyButton text={ai.pitch} />
                </div>
                {ai.pitch}
              </div>
            )}
            {!ai && pitchesLoading && <Skeleton height={36} />}
            <div>
              <Button size="sm" variant="secondary" onClick={() => onLoad(t.partnerRosterId, t.send, t.target)}>
                Load in trade builder → AI pitch
              </Button>
            </div>
          </div>
        );
      })}
      {!needs.trades.length && (
        <div style={{ padding: 14, fontSize: 13, color: "var(--text-faint)" }}>
          No fair trade lifts your lineup by 1+ pt/game without hurting the other team. Check waivers instead.
        </div>
      )}
      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-faint)" }}>
        Every idea is simulated on both rosters&apos; best lineups: you gain ≥1 pt/g, they lose ≤0.5. Priced in FantasyCalc
        market value within 90–115% of the target; in 2-for-1s the 2nd piece counts 60% (the receiver must cut someone). Don&apos;t
        pay above Max offer.
      </div>
    </Card>
  );
}

export function NeedsLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Skeleton height={44} />
      <Skeleton height={44} />
      <Skeleton height={44} />
    </div>
  );
}

export function StashCard({
  needs,
  notes,
}: {
  needs: NeedsResponse;
  notes?: GamePlanResponse["plan"]["stash"];
}) {
  const P = needs.players;
  if (!needs.stash.length) return null;
  return (
    <Card title="Stashes — buy before the market does" pad={false}>
      {needs.stash.map((s) => {
        const p = P[s.id];
        if (!p) return null;
        const note = notes?.find((n) => n.id === s.id)?.note;
        const best = (p.hist ?? []).filter((h) => h.games >= 6).slice(0, 2);
        return (
          <div key={s.id} style={{ padding: "9px 12px", borderBottom: "1px solid var(--line-1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Tag tone={s.kind === "HOLD" ? "value" : "accent"}>{s.kind === "HOLD" ? "HOLD" : "STASH ADD"}</Tag>
              <PositionBadge pos={p.pos as Position} size="sm" />
              <b style={{ fontSize: 14 }}>{p.name}</b>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                {p.team ?? "unsigned"}
                {p.injury ? ` · ${p.injury}` : ""}
                {s.where === "ir" ? " · in your IR slot (free to hold)" : s.where === "bench" ? " · your bench" : " · free agent"}
              </span>
              <span style={{ flex: 1 }} />
              <StatDelta value={s.gainIfBack} suffix="/g" label="if back" />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
              If back: ~{s.ifBack.toFixed(1)}/g (80% of {best.map((h) => `${h.season} ${h.ppg}`).join(" & ")} ppg)
              {p.age ? ` · age ${p.age}` : ""}
              {p.trend30 ? ` · market ${p.trend30 > 0 ? "+" : ""}${p.trend30} in 30d` : ""}
              {p.newsCount ? ` · ${p.newsCount} headline${p.newsCount > 1 ? "s" : ""} in 14d` : ""}
            </div>
            {p.headline && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>“{p.headline}”</div>}
            {s.kind === "SPEC" && s.bidNow != null && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Bid now <b style={{ color: "var(--accent)" }}>${s.bidNow}</b> vs ≈ <b style={{ color: "var(--text-body)" }}>${s.bidLater}</b> after a
                signing/return (our bid formula on +{s.gainIfBack}/g)
                {needs.irSlots.total > 0 && needs.irSlots.used >= needs.irSlots.total ? " · your IR slots are full, so this takes a bench spot" : ""}.
              </div>
            )}
            {note && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                <Tag>AI</Tag> {note}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-faint)" }}>
        Sidelined (unsigned or IR/PUP/SUS) players whose return would lift your lineup ≥1 pt/g. Holds are never suggested as
        cuts. Free-agent stashes need a live signal: recent headlines or a rising market value.
      </div>
    </Card>
  );
}
