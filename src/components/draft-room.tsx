"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Tabs } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Toast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TierBreak } from "@/components/ui/tier-break";
import { PlayerRow } from "@/components/ui/player-row";
import { PositionBadge, type Position } from "@/components/ui/position-badge";
import { Wordmark } from "@/components/wordmark";
import { TeamPickerModal, TeamChip, type TeamOption } from "@/components/team-picker-modal";
import type { BoardResponse } from "@/app/api/board/[leagueId]/route";
import type { SleeperDraft, SleeperPick } from "@/lib/sleeper";
import type { Ranked } from "@/lib/vbd";
import {
  slotForPick,
  pickLabel,
  picksUntilSlot,
  fillRoster,
  suggestPicks,
  scarcityNote,
  clockRemaining,
  gradeDraft,
} from "@/lib/draft-math";
import { useIsMobile } from "@/lib/use-mobile";
import { loadTeamPref, saveTeamPref, loadQueuePref, saveQueuePref } from "@/lib/session-client";
import { teamInitials } from "@/components/team-picker-modal";
import { GlossaryButton } from "@/components/glossary";
import { AccountButton } from "@/components/account";
import { authFetch } from "@/lib/auth-client";

const POS_TABS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
const MOBILE_PANES = ["BOARD", "QUEUE", "ROSTER", "PICKS"] as const;
type MobilePane = (typeof MOBILE_PANES)[number];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Snake pick strip: the next ~14 picks as chips (UX brief item 2). */
function PickStrip({
  nextPickNo,
  teams,
  maxPicks,
  mySlot,
  nameOfSlot,
}: {
  nextPickNo: number;
  teams: number;
  maxPicks: number;
  mySlot: number | null;
  nameOfSlot: (slot: number | undefined) => string;
}) {
  const picks: { no: number; rd: number }[] = [];
  for (let no = nextPickNo; no < nextPickNo + 14 && no <= maxPicks; no++) {
    picks.push({ no, rd: Math.ceil(no / teams) });
  }
  if (!picks.length) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        padding: "8px 16px",
        borderBottom: "1px solid var(--line-1)",
        background: "var(--surface-panel)",
        overflowX: "auto",
        flexShrink: 0,
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
        Up next
      </span>
      {picks.map((p, i) => {
        const slot = slotForPick(p.no, teams);
        const name = nameOfSlot(slot);
        const mine = mySlot != null && slot === mySlot;
        const current = p.no === nextPickNo;
        const newRound = i > 0 && p.rd !== picks[i - 1].rd;
        return (
          <React.Fragment key={p.no}>
            {newRound && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-faint)", flexShrink: 0, padding: "0 2px" }}>
                R{p.rd} ⇄
              </span>
            )}
            <div
              title={name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                flexShrink: 0,
                minWidth: 44,
                background: current ? "var(--accent-dim)" : mine ? "transparent" : "var(--bg-1)",
                border: "1px solid " + (current ? "var(--accent)" : mine ? "rgba(255,180,61,.5)" : "var(--line-1)"),
                animation: current ? "dday-pulse 2s infinite" : "none",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: current || mine ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {teamInitials(name)}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-faint)" }}>
                {pickLabel(p.no, teams)}
                {mine ? " · YOU" : ""}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Inline row expansion: stat strip + latest headline (UX brief item 4). */
function ExpandedDetail({ p, queued, onQueue }: { p: Ranked; queued: boolean; onQueue: () => void }) {
  const news = useQuery({
    queryKey: ["playerNews", p.sleeperId],
    queryFn: () =>
      getJson<{ items: { title: string; source: string }[] }>(`/api/player/${p.sleeperId}/news`),
    staleTime: 10 * 60 * 1000,
  });
  const cells: [string, string, string][] = [
    ["PROJ", `${p.points} pts`, "Projected season points under your league's exact scoring."],
    ["VBD", `${p.vbd > 0 ? "+" : ""}${p.vbd}`, "Points above a replacement-level starter at this position — the board ranks by this."],
    ["ADP", p.adp != null ? String(Math.round(p.adp)) : "—", "Average Draft Position — where the market takes this player."],
    ["FC VALUE", p.fc != null ? p.fc.toLocaleString() : "—", "FantasyCalc trade-market value for your league shape."],
    ["TIER", String(p.tier), "Boris Chen tier — players inside a tier are interchangeable."],
    ["BYE", p.bye != null ? String(p.bye) : "—", "Week this player's team doesn't play."],
  ];
  return (
    <div style={{ padding: "10px 12px 14px 46px", borderBottom: "1px solid var(--line-1)", background: "var(--bg-1)" }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        {cells.map(([l, v, help]) => (
          <div key={l} title={help} style={{ cursor: "help" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", color: "var(--text-faint)" }}>{l}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
        {p.injury && <Tag tone="reach">{p.injury}</Tag>}
        <div style={{ marginLeft: "auto" }}>
          <Button
            variant={queued ? "secondary" : "primary"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onQueue();
            }}
          >
            {queued ? "★ Queued" : "☆ Queue"}
          </Button>
        </div>
      </div>
      {(news.data?.items?.length ?? 0) > 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
          <Tag tone="neutral" style={{ marginRight: 8 }}>
            NEWS
          </Tag>
          {news.data!.items[0].title}
          <span style={{ color: "var(--text-faint)" }}> ({news.data!.items[0].source})</span>
        </div>
      )}
    </div>
  );
}

export function DraftRoom({ leagueId, draftId: mockDraftId }: { leagueId?: string; draftId?: string }) {
  const router = useRouter();
  const scope = leagueId ?? `draft:${mockDraftId}`;
  const board = useQuery({
    queryKey: ["board", scope],
    queryFn: () =>
      getJson<BoardResponse>(leagueId ? `/api/board/${leagueId}` : `/api/board/by-draft/${mockDraftId}`),
    staleTime: 5 * 60 * 1000,
  });

  const draftId = mockDraftId ?? board.data?.league.draftId ?? null;
  const draftState = useQuery({
    queryKey: ["draft", draftId],
    queryFn: () => getJson<{ draft: SleeperDraft; picks: SleeperPick[] }>(`/api/draft/${draftId}/picks`),
    enabled: !!draftId,
    // Poll cadence follows the league's pick clock: ~1/15th of the timer,
    // clamped to 2–5s while drafting (60s clock → 4s). Paused/pre-draft
    // polls at 7s so a resume is caught quickly; complete stops polling.
    refetchInterval: (q) => {
      const st = q.state.data?.draft.status;
      if (st === "drafting") {
        const timer = q.state.data?.draft.settings.pick_timer ?? 60;
        return Math.min(5000, Math.max(2000, Math.round((timer * 1000) / 15)));
      }
      if (st === "paused" || st === "pre_draft") return 7000;
      return false;
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const isMobile = useIsMobile();
  const [pos, setPos] = React.useState("ALL");
  const [hideDrafted, setHideDrafted] = React.useState(true);
  const [myUserId, setMyUserId] = React.useState<string>("");
  const [prefsLoaded, setPrefsLoaded] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerDismissed, setPickerDismissed] = React.useState(false);
  const [queue, setQueue] = React.useState<string[]>([]);
  const [openRow, setOpenRow] = React.useState<string | null>(null);
  const [mobilePane, setMobilePane] = React.useState<MobilePane>("BOARD");

  // Session-backed prefs: team + queue, per league/draft scope.
  React.useEffect(() => {
    let cancelled = false;
    Promise.all([loadTeamPref(scope), loadQueuePref(scope)]).then(([team, q]) => {
      if (cancelled) return;
      if (team) setMyUserId(team);
      if (q.length) setQueue(q);
      setPrefsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [scope]);
  const chooseTeam = (id: string) => {
    setMyUserId(id);
    saveTeamPref(scope, id);
    setPickerOpen(false);
  };
  const toggleQueue = (sleeperId: string) => {
    setQueue((q) => {
      const next = q.includes(sleeperId) ? q.filter((x) => x !== sleeperId) : [...q, sleeperId];
      saveQueuePref(scope, next);
      return next;
    });
  };

  // 1s clock tick while drafting.
  const [now, setNow] = React.useState(() => Date.now());
  const drafting = draftState.data?.draft.status === "drafting";
  React.useEffect(() => {
    if (!drafting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [drafting]);

  // Pick-made trigger: the clock hitting zero means a pick (or autopick) just
  // happened — refetch immediately instead of waiting out the poll interval.
  const lastZeroRefetch = React.useRef(0);
  const secondsLeftNow = draftState.data ? clockRemaining(draftState.data.draft, now) : null;
  React.useEffect(() => {
    if (secondsLeftNow === 0 && Date.now() - lastZeroRefetch.current > 1500) {
      lastZeroRefetch.current = Date.now();
      draftState.refetch();
    }
  }, [secondsLeftNow, draftState]);

  // Draft recap snapshot: once per completed draft, fire-and-forget (the
  // history route dedupes by draftId). (proposals/ACCOUNTS-HISTORY.md item 5)
  const recapPosted = React.useRef(false);
  React.useEffect(() => {
    const b = board.data;
    const ds = draftState.data;
    if (!b || !ds || ds.draft.status !== "complete" || !ds.picks.length || !draftId || recapPosted.current) return;
    const order = ds.draft.draft_order ?? {};
    const slot = myUserId.startsWith("slot:") ? Number(myUserId.slice(5)) || null : (order[myUserId] ?? null);
    if (slot == null) return;
    recapPosted.current = true;
    const teamCount = ds.draft.settings.teams ?? b.league.teams;
    const mine = gradeDraft(b.board, ds.picks, teamCount).find((g) => g.slot === slot);
    if (!mine) return;
    const byId = new Map(b.board.map((p) => [p.sleeperId, p]));
    let best: { name: string; label: string; d: number } | null = null;
    let reach: { name: string; label: string; d: number } | null = null;
    for (const pick of ds.picks.filter((p) => p.draft_slot === slot)) {
      const row = byId.get(pick.player_id);
      if (!row || row.adp == null) continue;
      const d = pick.pick_no - row.adp;
      const entry = { name: row.name, label: pickLabel(pick.pick_no, teamCount), d };
      if (!best || d > best.d) best = entry;
      if (!reach || d < reach.d) reach = entry;
    }
    authFetch("/api/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leagueId: leagueId ?? `draft:${draftId}`,
        kind: "draft_recap",
        payload: {
          draftId,
          season: b.league.season,
          grade: mine.grade,
          totalVbd: mine.totalVbd,
          steal: mine.steal,
          bestPick: best ? { name: best.name, label: best.label } : undefined,
          biggestReach: reach ? { name: reach.name, label: reach.label } : undefined,
        },
      }),
    }).catch(() => {});
  }, [board.data, draftState.data, myUserId, leagueId, draftId]);

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
  const rowById = new Map(rows.map((p) => [p.sleeperId, p]));
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
  // Mock drafts have no league users — pick by draft slot instead.
  const userBased = (orderedUsers.length ? orderedUsers : users).length > 0;
  const teamOptions: TeamOption[] = userBased
    ? (orderedUsers.length ? orderedUsers : users).map((u) => ({
        value: u.userId,
        label: u.teamName ?? u.name,
        slot: draftOrder[u.userId] ?? null,
      }))
    : Array.from({ length: teams }, (_, i) => ({ value: `slot:${i + 1}`, label: `Slot ${i + 1}`, slot: i + 1 }));
  const mySlot = myUserId.startsWith("slot:")
    ? Number(myUserId.slice(5)) || null
    : (draftOrder[myUserId] ?? null);
  const myTeamLabel = teamOptions.find((t) => t.value === myUserId)?.label ?? null;

  const nextPickNo = picks.length + 1;
  const onClockSlot = drafting ? slotForPick(nextPickNo, teams) : null;
  const slotToUser = new Map(Object.entries(draftOrder).map(([uid, slot]) => [slot, uid]));
  const nameOfSlot = (slot: number | undefined) => {
    if (slot == null) return "—";
    const uid = slotToUser.get(slot);
    const u = users.find((x) => x.userId === uid);
    return u?.teamName ?? u?.name ?? `Slot ${slot}`;
  };
  const untilMe =
    drafting && mySlot != null ? picksUntilSlot(nextPickNo, mySlot, teams, maxPicks) : null;
  const secondsLeft = draft ? clockRemaining(draft, now) : null;

  const myPicks = mySlot != null ? picks.filter((p) => p.draft_slot === mySlot) : [];
  const roster = fillRoster(league.rosterPositions, myPicks);
  const rounds = draft?.settings.rounds ?? league.rosterPositions.length;
  const recValue = league.scoring === "PPR" ? 1 : league.scoring === "Half PPR" ? 0.5 : parseFloat(league.scoring) || 0;
  const complete = draft?.status === "complete";
  const suggestions =
    mySlot != null && !complete
      ? suggestPicks(available, roster, {
          rec: recValue,
          superflex: league.superflex,
          remainingPicks: Math.max(0, rounds - myPicks.length),
        })
      : [];
  const scarcity = mySlot != null && !complete ? scarcityNote(available, roster) : null;
  const grades = complete && picks.length ? gradeDraft(rows, picks, teams) : [];

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
  const newestPickNo = picks.length ? picks[picks.length - 1].pick_no : null;

  // Keyboard: ↑↓ move the open row, Enter toggles, Q queues (item 4).
  const onBoardKeyDown = (e: React.KeyboardEvent) => {
    if (!visible.length) return;
    const idx = openRow ? visible.findIndex((p) => p.sleeperId === openRow) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpenRow(visible[Math.min(visible.length - 1, idx + 1)].sleeperId);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpenRow(visible[Math.max(0, idx - 1)].sleeperId);
    } else if (e.key === "Enter" && openRow) {
      e.preventDefault();
      setOpenRow(null);
    } else if ((e.key === "q" || e.key === "Q") && openRow) {
      e.preventDefault();
      toggleQueue(openRow);
    }
  };

  const showPickerModal =
    prefsLoaded && !myUserId && !pickerDismissed && teamOptions.length > 0 && !board.isLoading;

  const starButton = (p: Ranked) => (
    <IconButton
      label={queue.includes(p.sleeperId) ? "Remove from queue" : "Add to queue"}
      size="sm"
      active={queue.includes(p.sleeperId)}
      onClick={(e) => {
        e.stopPropagation();
        toggleQueue(p.sleeperId);
      }}
    >
      <span style={{ fontSize: 14 }}>{queue.includes(p.sleeperId) ? "★" : "☆"}</span>
    </IconButton>
  );

  const boardCard = (
    <Card
      title="Best available"
      pad={false}
      style={{
        flexGrow: isMobile ? 1 : 1,
        flexShrink: 1,
        flexBasis: "auto",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
      }}
      action={
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Tabs size="sm" items={POS_TABS} value={pos} onChange={setPos} />
          {!isMobile && <Switch checked={hideDrafted} onChange={setHideDrafted} label="Hide drafted" />}
        </div>
      }
    >
      <div style={{ overflowY: "auto", flex: 1, outline: "none" }} tabIndex={0} onKeyDown={onBoardKeyDown}>
        {isMobile && (
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--line-1)" }}>
            <Switch checked={hideDrafted} onChange={setHideDrafted} label="Hide drafted" />
          </div>
        )}
        {grouped.map((g, gi) => (
          <React.Fragment key={`${g.tier}-${gi}`}>
            <TierBreak
              tier={g.tier}
              note={`${g.players.filter((p) => !draftedIds.has(p.sleeperId)).length} left`}
            />
            {g.players.map((p) => (
              <React.Fragment key={p.sleeperId}>
                <PlayerRow
                  rank={p.rank}
                  name={p.name}
                  pos={p.pos as Position}
                  team={p.team}
                  bye={p.bye}
                  vbd={p.vbd}
                  adpDelta={p.adpDelta}
                  injury={p.injury}
                  drafted={draftedIds.has(p.sleeperId)}
                  onClick={() => setOpenRow((o) => (o === p.sleeperId ? null : p.sleeperId))}
                  trailing={starButton(p)}
                  style={openRow === p.sleeperId ? { background: "var(--bg-1)", borderBottom: "none" } : undefined}
                />
                {openRow === p.sleeperId && (
                  <ExpandedDetail p={p} queued={queue.includes(p.sleeperId)} onQueue={() => toggleQueue(p.sleeperId)} />
                )}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
        {!visible.length && (
          <div style={{ padding: 16, fontSize: "var(--text-sm)", color: "var(--text-faint)", display: "flex", gap: 12, alignItems: "center" }}>
            Nothing left under this filter.
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPos("ALL");
                setHideDrafted(false);
              }}
            >
              Clear filter
            </Button>
          </div>
        )}
      </div>
    </Card>
  );

  const queueCard = (
    <Card
      title="My queue"
      pad={false}
      style={{ flexShrink: 0 }}
      action={<span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>{queue.length}</span>}
    >
      {queue.length ? (
        queue.map((id, i) => {
          const p = rowById.get(id);
          if (!p) return null;
          const gone = draftedIds.has(id);
          return (
            <div
              key={id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderBottom: "1px solid var(--line-1)",
                opacity: gone ? 0.4 : 1,
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", width: 14 }}>{i + 1}</span>
              <PositionBadge pos={p.pos as Position} size="sm" />
              <span style={{ fontSize: 13, flex: 1, textDecoration: gone ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
              </span>
              {gone ? (
                <Tag tone="reach">SNIPED</Tag>
              ) : (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>+{p.vbd}</span>
              )}
              <IconButton label="Remove" size="sm" onClick={() => toggleQueue(id)}>
                <span style={{ fontSize: 12 }}>✕</span>
              </IconButton>
            </div>
          );
        })
      ) : (
        <div style={{ padding: 12, fontSize: 12, color: "var(--text-faint)" }}>
          Star players on the board to shortlist them here. Queued players auto-strike when drafted.
        </div>
      )}
    </Card>
  );

  const gradesCard = grades.length > 0 && (
    <Card title="Draft grades" style={{ flexShrink: 0 }} pad={false}>
      {mySlot != null && (
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontStretch: "125%",
              fontWeight: 850,
              fontSize: 40,
              color: "var(--accent)",
              lineHeight: 1,
            }}
          >
            {grades.find((g) => g.slot === mySlot)?.grade ?? "—"}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            your draft ·{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>
              +{grades.find((g) => g.slot === mySlot)?.totalVbd ?? 0} VBD
            </span>{" "}
            · {grades.find((g) => g.slot === mySlot)?.steal ?? 0} ADP steals
          </span>
        </div>
      )}
      {grades.map((g) => (
        <div
          key={g.slot}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 16px",
            borderBottom: "1px solid var(--line-1)",
            background: g.slot === mySlot ? "var(--accent-dim)" : "transparent",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, width: 26, color: g.slot === mySlot ? "var(--accent)" : "var(--text-body)" }}>
            {g.grade}
          </span>
          <span style={{ flex: 1, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nameOfSlot(g.slot)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>+{g.totalVbd}</span>
        </div>
      ))}
    </Card>
  );

  const suggestedCard = suggestions.length > 0 && (
    <Card title="Suggested pick" glow={untilMe === 0} style={{ flexShrink: 0 }}>
      {suggestions.map((s, i) => (
        <div key={s.player.sleeperId} style={{ marginTop: i ? 12 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PositionBadge pos={s.player.pos as Position} />
            <span style={{ fontWeight: 700, fontSize: i === 0 ? 16 : 14, flex: 1 }}>{s.player.name}</span>
            {s.player.adpDelta != null && s.player.adpDelta >= 5 && (
              <span
                title={`Market discount: available ~${s.player.adpDelta} picks later than ADP. Not extra points — VBD is the points number.`}
                style={{ cursor: "help" }}
              >
                <Tag tone="value">VALUE +{s.player.adpDelta}</Tag>
              </span>
            )}
            <IconButton
              label={queue.includes(s.player.sleeperId) ? "In queue" : "Add to queue"}
              size="sm"
              active={queue.includes(s.player.sleeperId)}
              onClick={() => toggleQueue(s.player.sleeperId)}
            >
              <span style={{ fontSize: 13 }}>{queue.includes(s.player.sleeperId) ? "★" : "☆"}</span>
            </IconButton>
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
  );

  const rosterCard = mySlot != null && (
    <Card title="My roster" pad={false} style={{ flexShrink: 0 }}>
      {roster.map((s, i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: "1px solid var(--line-1)" }}
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
  );

  const degradedToast = degraded.length > 0 && (
    <Toast tone="warn" title="Projections degraded" style={{ flexShrink: 0 }}>
      {degraded.join(", ")} refresh failed — showing cached data.
    </Toast>
  );

  const onClockPill = drafting && (
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
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--accent)" }}>
        On the clock
      </span>
      {secondsLeft != null && (
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
        </span>
      )}
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {pickLabel(nextPickNo, teams)} · {nameOfSlot(onClockSlot ?? undefined)}
        {untilMe != null && untilMe > 0 && ` · you're up in ${untilMe}`}
        {untilMe === 0 && " · you're up"}
      </span>
    </div>
  );

  const navSegment = leagueId && (
    <Tabs
      size="sm"
      items={["BOARD", "DASHBOARD"]}
      value="BOARD"
      onChange={(v) => v === "DASHBOARD" && router.push(`/league/${leagueId}`)}
    />
  );

  const teamControl = myTeamLabel ? (
    <TeamChip label={myTeamLabel} onClick={() => setPickerOpen(true)} />
  ) : (
    <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
      Pick team
    </Button>
  );

  const identityRow = (
    <>
      <Link href="/" title="Home — look up another league" style={{ textDecoration: "none", color: "inherit" }}>
        <Wordmark size={20} />
      </Link>
      <span style={{ fontSize: 13, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {league.name}
      </span>
      <Tag>{league.scoring}</Tag>
      {league.superflex && <Tag>Superflex</Tag>}
      {!drafting && draft && (
        <Tag tone={complete ? "neutral" : "accent"}>{draft.status.replace("_", "-").toUpperCase()}</Tag>
      )}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      {(showPickerModal || pickerOpen) && (
        <TeamPickerModal
          options={teamOptions}
          onPick={chooseTeam}
          onSkip={() => {
            setPickerDismissed(true);
            setPickerOpen(false);
          }}
        />
      )}

      {/* Header: single row on desktop, two rows on mobile (item 5). */}
      {isMobile ? (
        <header style={{ borderBottom: "1px solid var(--line-1)", background: "var(--surface-panel)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px 4px" }}>{identityRow}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 12px 8px", overflowX: "auto" }}>
            {onClockPill}
            {navSegment}
            {teamControl}
            <GlossaryButton />
            <AccountButton leagueId={leagueId} />
          </div>
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
            flexShrink: 0,
          }}
        >
          {identityRow}
          <span style={{ flex: 1 }} />
          {onClockPill}
          {navSegment}
          {teamControl}
          <GlossaryButton />
          <AccountButton leagueId={leagueId} />
        </header>
      )}

      {!complete && (
        <PickStrip nextPickNo={nextPickNo} teams={teams} maxPicks={maxPicks} mySlot={mySlot} nameOfSlot={nameOfSlot} />
      )}

      {isMobile ? (
        <>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 10, gap: 10, overflowY: "auto" }}>
            {mobilePane === "BOARD" && boardCard}
            {mobilePane === "QUEUE" && (
              <>
                {degradedToast}
                {queueCard}
                {suggestedCard}
                {scarcity && (
                  <Toast tone="warn" title="Scarcity" style={{ flexShrink: 0 }}>
                    {scarcity}
                  </Toast>
                )}
              </>
            )}
            {mobilePane === "ROSTER" && (
              <>
                {gradesCard}
                {rosterCard}
                {mySlot == null && (
                  <Toast tone="accent" title="Pick your team">
                    Choose your team to get roster tracking and suggested picks.
                  </Toast>
                )}
              </>
            )}
            {mobilePane === "PICKS" && (
              <Card title="All picks" pad={false}>
                {picks.length ? (
                  [...picks].reverse().map((p) => (
                    <div
                      key={p.pick_no}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--line-1)",
                        minHeight: 44,
                        animation: p.pick_no === newestPickNo ? "dday-pulse 1.5s 1" : "none",
                        borderRadius: p.pick_no === newestPickNo ? "var(--radius-sm)" : 0,
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", width: 36 }}>
                        {pickLabel(p.pick_no, teams)}
                      </span>
                      {p.metadata?.position && <PositionBadge pos={p.metadata.position as Position} size="sm" />}
                      <span style={{ fontSize: 13, flex: 1 }}>
                        {p.metadata?.first_name} {p.metadata?.last_name}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{nameOfSlot(p.draft_slot)}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: 12, fontSize: 12, color: "var(--text-faint)" }}>No picks yet.</div>
                )}
              </Card>
            )}
          </div>
          {/* Bottom tab bar (item 6). */}
          <nav
            style={{
              display: "flex",
              borderTop: "1px solid var(--line-1)",
              background: "var(--surface-panel)",
              flexShrink: 0,
            }}
          >
            {MOBILE_PANES.map((pane) => (
              <button
                key={pane}
                onClick={() => setMobilePane(pane)}
                style={{
                  flex: 1,
                  minHeight: "var(--control-h-lg)",
                  background: "transparent",
                  border: "none",
                  borderTop: "2px solid " + (mobilePane === pane ? "var(--accent)" : "transparent"),
                  color: mobilePane === pane ? "var(--accent)" : "var(--text-muted)",
                  fontFamily: "var(--font-body)",
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: ".06em",
                  cursor: "pointer",
                }}
              >
                {pane}
                {pane === "QUEUE" && queue.length > 0 && (
                  <span style={{ fontFamily: "var(--font-mono)", marginLeft: 4, color: "var(--text-faint)" }}>{queue.length}</span>
                )}
              </button>
            ))}
          </nav>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, padding: 14, flex: 1, minHeight: 0, alignItems: "stretch" }}>
            {boardCard}
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
              {degradedToast}
              {gradesCard}
              {queueCard}
              {suggestedCard}
              {rosterCard}
              {mySlot == null && (
                <Toast tone="accent" title="Pick your team" style={{ flexShrink: 0 }}>
                  Choose your team above to get roster tracking and suggested picks.
                </Toast>
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
                overflowX: "auto",
                overflowY: "hidden",
                flexShrink: 0,
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
                    padding: "2px 6px",
                    borderRadius: "var(--radius-sm)",
                    animation: p.pick_no === newestPickNo ? "dday-pulse 1.5s 1" : "none",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
                    {pickLabel(p.pick_no, teams)}
                  </span>
                  {p.metadata?.position && <PositionBadge pos={p.metadata.position as Position} size="sm" />}
                  <b style={{ color: "var(--text-body)", fontWeight: 600 }}>
                    {p.metadata?.first_name} {p.metadata?.last_name}
                  </b>
                  <span style={{ color: "var(--text-faint)" }}>{nameOfSlot(p.draft_slot)}</span>
                </span>
              ))}
            </footer>
          )}
        </>
      )}
    </div>
  );
}
