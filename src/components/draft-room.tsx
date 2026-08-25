"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Tabs } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Toast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TierBreak } from "@/components/ui/tier-break";
import { PlayerRow } from "@/components/ui/player-row";
import { PositionBadge, type Position } from "@/components/ui/position-badge";
import { Wordmark } from "@/components/wordmark";
import type { BoardResponse } from "@/app/api/board/[leagueId]/route";
import type { SleeperDraft, SleeperPick } from "@/lib/sleeper";
import {
  slotForPick,
  pickLabel,
  picksUntilSlot,
  fillRoster,
  suggestPicks,
  scarcityNote,
  clockRemaining,
} from "@/lib/draft-math";

const POS_TABS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export function DraftRoom({ leagueId }: { leagueId: string }) {
  const board = useQuery({
    queryKey: ["board", leagueId],
    queryFn: () => getJson<BoardResponse>(`/api/board/${leagueId}`),
    staleTime: 5 * 60 * 1000,
  });

  const draftId = board.data?.league.draftId ?? null;
  const draftState = useQuery({
    queryKey: ["draft", draftId],
    queryFn: () => getJson<{ draft: SleeperDraft; picks: SleeperPick[] }>(`/api/draft/${draftId}/picks`),
    enabled: !!draftId,
    refetchInterval: (q) => (q.state.data?.draft.status === "drafting" ? 3000 : false),
  });

  const [pos, setPos] = React.useState("ALL");
  const [hideDrafted, setHideDrafted] = React.useState(true);
  const [myUserId, setMyUserId] = React.useState<string>("");

  // Remember the chosen team per league (no-login product). localStorage is
  // client-only, so this must run post-hydration rather than in an initializer.
  React.useEffect(() => {
    const stored = localStorage.getItem(`dday:team:${leagueId}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe localStorage hydration
    if (stored) setMyUserId(stored);
  }, [leagueId]);
  const chooseTeam = (id: string) => {
    setMyUserId(id);
    localStorage.setItem(`dday:team:${leagueId}`, id);
  };

  // 1s clock tick while drafting.
  const [now, setNow] = React.useState(() => Date.now());
  const drafting = draftState.data?.draft.status === "drafting";
  React.useEffect(() => {
    if (!drafting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [drafting]);

  if (board.isLoading) {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Wordmark size={20} />
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            Building your board — first load computes league-tuned VBD…
          </span>
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} height={44} />
        ))}
      </div>
    );
  }
  if (board.isError || !board.data) {
    return (
      <div style={{ padding: 48, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
        <Wordmark size={28} />
        <Toast tone="reach" title="Board unavailable">
          {board.error instanceof Error ? board.error.message : "Try again shortly."}
        </Toast>
      </div>
    );
  }

  const { league, users, board: rows, degraded } = board.data;
  const draft = draftState.data?.draft ?? null;
  const picks = draftState.data?.picks ?? [];
  const teams = draft?.settings.teams ?? league.teams;
  const maxPicks = teams * (draft?.settings.rounds ?? league.rosterPositions.length);

  const draftedIds = new Set(picks.map((p) => p.player_id));
  const available = rows.filter((p) => !draftedIds.has(p.sleeperId));

  const draftOrder = draft?.draft_order ?? {};
  const orderedUsers = users
    .filter((u) => u.userId in draftOrder)
    .sort((a, b) => (draftOrder[a.userId] ?? 99) - (draftOrder[b.userId] ?? 99));
  const teamOptions = (orderedUsers.length ? orderedUsers : users).map((u) => ({
    value: u.userId,
    label: u.teamName ?? u.name,
  }));
  const mySlot = draftOrder[myUserId] ?? null;

  const nextPickNo = picks.length + 1;
  const onClockSlot = drafting ? slotForPick(nextPickNo, teams) : null;
  const slotToUser = new Map(Object.entries(draftOrder).map(([uid, slot]) => [slot, uid]));
  const nameOf = (uid: string | undefined) => {
    const u = users.find((x) => x.userId === uid);
    return u?.teamName ?? u?.name ?? "—";
  };
  const untilMe =
    drafting && mySlot != null ? picksUntilSlot(nextPickNo, mySlot, teams, maxPicks) : null;
  const secondsLeft = draft ? clockRemaining(draft, now) : null;

  const myPicks = mySlot != null ? picks.filter((p) => p.draft_slot === mySlot) : [];
  const roster = fillRoster(league.rosterPositions, myPicks);
  const suggestions = mySlot != null ? suggestPicks(available, roster) : [];
  const scarcity = mySlot != null ? scarcityNote(available, roster) : null;

  const visible = rows.filter(
    (p) => (pos === "ALL" || p.pos === pos) && !(hideDrafted && draftedIds.has(p.sleeperId)),
  );
  const grouped: { tier: number; players: typeof visible }[] = [];
  for (const p of visible) {
    const g = grouped[grouped.length - 1];
    if (g && g.tier === p.tier) g.players.push(p);
    else grouped.push({ tier: p.tier, players: [p] });
  }

  const recent = picks.slice(-6).reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 16px",
          borderBottom: "1px solid var(--line-1)",
          background: "var(--surface-panel)",
          flexWrap: "wrap",
        }}
      >
        <Wordmark size={20} />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{league.name}</span>
        <Tag>{league.scoring}</Tag>
        {league.superflex && <Tag>Superflex</Tag>}
        <span style={{ flex: 1 }} />
        {drafting && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--accent-dim)",
              border: "1px solid rgba(255,180,61,.4)",
              borderRadius: "var(--radius-pill)",
              padding: "4px 14px",
              animation: "dday-pulse 2s infinite",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--accent)",
              }}
            >
              On the clock
            </span>
            {secondsLeft != null && (
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {pickLabel(nextPickNo, teams)} · {nameOf(slotToUser.get(onClockSlot ?? -1))}
              {untilMe != null && untilMe > 0 && ` · you're up in ${untilMe}`}
              {untilMe === 0 && " · you're up"}
            </span>
          </div>
        )}
        {!drafting && draft && <Tag tone={draft.status === "complete" ? "neutral" : "accent"}>{draft.status.replace("_", "-").toUpperCase()}</Tag>}
        <Select
          options={[{ value: "", label: "Pick your team…" }, ...teamOptions]}
          value={myUserId}
          onChange={(e) => chooseTeam(e.target.value)}
          style={{ width: 180 }}
        />
      </header>

      <div style={{ display: "flex", gap: 14, padding: 14, flex: 1, minHeight: 0, alignItems: "stretch" }}>
        <Card
          title="Best available"
          pad={false}
          style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
          action={
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Tabs size="sm" items={POS_TABS} value={pos} onChange={setPos} />
              <Switch checked={hideDrafted} onChange={setHideDrafted} label="Hide drafted" />
            </div>
          }
        >
          <div style={{ overflowY: "auto", flex: 1 }}>
            {grouped.map((g, gi) => (
              <React.Fragment key={`${g.tier}-${gi}`}>
                <TierBreak
                  tier={g.tier}
                  note={`${g.players.filter((p) => !draftedIds.has(p.sleeperId)).length} left`}
                />
                {g.players.map((p) => (
                  <PlayerRow
                    key={p.sleeperId}
                    rank={p.rank}
                    name={p.name}
                    pos={p.pos as Position}
                    team={p.team}
                    bye={p.bye}
                    vbd={p.vbd}
                    adpDelta={p.adpDelta}
                    injury={p.injury}
                    drafted={draftedIds.has(p.sleeperId)}
                  />
                ))}
              </React.Fragment>
            ))}
            {!visible.length && (
              <div style={{ padding: 16, fontSize: "var(--text-sm)", color: "var(--text-faint)" }}>
                Nothing left under this filter.
              </div>
            )}
          </div>
        </Card>

        <div
          style={{
            width: 320,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            flexShrink: 0,
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          {degraded.length > 0 && (
            <Toast tone="warn" title="Projections degraded" style={{ flexShrink: 0 }}>
              {degraded.join(", ")} refresh failed — showing cached data.
            </Toast>
          )}
          {mySlot == null && (
            <Toast tone="accent" title="Pick your team" style={{ flexShrink: 0 }}>
              Choose your team above to get roster tracking and suggested picks.
            </Toast>
          )}
          {suggestions.length > 0 && (
            <Card title="Suggested pick" glow={untilMe === 0} style={{ flexShrink: 0 }}>
              {suggestions.map((s, i) => (
                <div key={s.player.sleeperId} style={{ marginTop: i ? 12 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PositionBadge pos={s.player.pos as Position} />
                    <span style={{ fontWeight: 700, fontSize: i === 0 ? 16 : 14 }}>{s.player.name}</span>
                    {s.player.adpDelta != null && s.player.adpDelta >= 5 && (
                      <Tag tone="value">VALUE +{s.player.adpDelta}</Tag>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    <span style={{ fontFamily: "var(--font-mono)" }}>
                      +{s.player.vbd} VBD{s.player.adp != null && ` · ADP ${Math.round(s.player.adp)}`}
                    </span>{" "}
                    — {s.why}
                  </div>
                </div>
              ))}
            </Card>
          )}
          {mySlot != null && (
            <Card title="My roster" pad={false} style={{ flexShrink: 0 }}>
              {roster.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 12px",
                    borderBottom: "1px solid var(--line-1)",
                  }}
                >
                  <PositionBadge pos={s.slot} size="sm" />
                  {s.player ? (
                    <span style={{ fontSize: 13 }}>
                      {s.player.metadata?.first_name} {s.player.metadata?.last_name}
                      <span style={{ color: "var(--text-faint)" }}> — {s.player.metadata?.team ?? "FA"}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-faint)" }}>
                      Empty
                      {s.need && <Tag tone="warn" style={{ marginLeft: 8 }}>NEED</Tag>}
                    </span>
                  )}
                </div>
              ))}
            </Card>
          )}
          {scarcity && (
            <Toast tone="warn" title="Scarcity" style={{ flexShrink: 0 }}>
              {scarcity}
            </Toast>
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <footer
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            padding: "8px 16px",
            borderTop: "1px solid var(--line-1)",
            background: "var(--surface-panel)",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
              flexShrink: 0,
            }}
          >
            Recent picks
          </span>
          {recent.map((p) => (
            <span
              key={p.pick_no}
              style={{
                display: "inline-flex",
                gap: 6,
                alignItems: "center",
                fontSize: 12,
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
                {pickLabel(p.pick_no, teams)}
              </span>
              {p.metadata?.position && <PositionBadge pos={p.metadata.position as Position} size="sm" />}
              <b style={{ color: "var(--text-body)", fontWeight: 600 }}>
                {p.metadata?.first_name} {p.metadata?.last_name}
              </b>
              <span style={{ color: "var(--text-faint)" }}>{nameOf(slotToUser.get(p.draft_slot))}</span>
            </span>
          ))}
        </footer>
      )}
    </div>
  );
}
