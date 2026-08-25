"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { StatDelta } from "@/components/ui/stat-delta";
import { teamInitials } from "@/components/team-picker-modal";
import {
  shouldInitAuth,
  authClient,
  setAuthedFlag,
  sendMagicLink,
  signInWithGoogle,
  signOut,
  mergeOnce,
  authFetch,
} from "@/lib/auth-client";
import type { RecentLeague } from "@/app/api/leagues/recent/route";
import type { HistoryItem } from "@/app/api/history/route";
import type { TradeEvaluation } from "@/app/api/league/[id]/trade/route";

/** Lazy auth state: does nothing for anonymous users until they opt in. */
export function useAccount(): { user: User | null } {
  const [user, setUser] = React.useState<User | null>(null);
  React.useEffect(() => {
    if (!shouldInitAuth()) return;
    const client = authClient();
    let cancelled = false;
    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
    });
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session?.user) {
        setAuthedFlag(true);
        mergeOnce(session.user.id);
      }
      if (event === "SIGNED_OUT") setAuthedFlag(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { user };
}

/** Header entry point: "Sign in" pill when anonymous, account menu when not. */
export function AccountButton({ leagueId }: { leagueId?: string | null }) {
  const { user } = useAccount();
  const [sheet, setSheet] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const [history, setHistory] = React.useState(false);
  const email = user?.email ?? "";

  return (
    <>
      <div style={{ position: "relative" }}>
        <button
          onClick={() => (user ? setMenu((m) => !m) : setSheet(true))}
          title={user ? "Account" : "Sign in — optional, syncs across devices"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "1px solid var(--line-2)",
            borderRadius: "var(--radius-pill)",
            padding: user ? "3px 12px 3px 4px" : "3px 12px",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: 11,
            fontFamily: "var(--font-body)",
            maxWidth: 180,
          }}
        >
          {user && (
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "var(--accent-dim)",
                border: "1px solid rgba(255,180,61,.4)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                fontWeight: 700,
                color: "var(--accent)",
                flexShrink: 0,
              }}
            >
              {teamInitials(email || "??")}
            </span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user ? email : "Sign in"}
          </span>
        </button>
        {menu && user && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 6px)",
              background: "var(--surface-raised)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-pop)",
              minWidth: 180,
              zIndex: 110,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-faint)", borderBottom: "1px solid var(--line-1)" }}>
              {email}
            </div>
            {[
              { label: "History", action: () => setHistory(true) },
              {
                label: "Sign out",
                action: async () => {
                  await signOut();
                  window.location.reload();
                },
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setMenu(false);
                  item.action();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-body)",
                  fontSize: 13,
                  fontFamily: "var(--font-body)",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {sheet && <SignInSheet onClose={() => setSheet(false)} />}
      {history && <HistoryDrawer leagueId={leagueId ?? undefined} onClose={() => setHistory(false)} />}
    </>
  );
}

export function SignInSheet({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const send = async () => {
    if (!/.+@.+\..+/.test(email) || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await sendMagicLink(email.trim());
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,14,17,.8)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 120,
        padding: 24,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Card
          title="Sync across devices"
          style={{ width: 400, maxWidth: "100%" }}
          action={
            <IconButton label="Close" size="sm" onClick={onClose}>
              <span style={{ fontSize: 12 }}>✕</span>
            </IconButton>
          }
        >
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Keep your leagues, queues and trade history on every device.{" "}
            <strong style={{ color: "var(--text-body)" }}>Everything works without an account</strong> — this just
            makes it portable.
          </div>
          {sent ? (
            <div style={{ fontSize: 13, padding: "14px 0" }}>
              <Tag tone="value">SENT</Tag>
              <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>Check your inbox for the magic link.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  style={{ flex: 1 }}
                />
                <Button variant="primary" onClick={send} disabled={busy}>
                  {busy ? "Sending…" : "Send link"}
                </Button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-faint)", fontSize: 11 }}>
                <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
                or
                <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
              </div>
              <Button
                variant="secondary"
                onClick={async () => {
                  const { error: err } = await signInWithGoogle();
                  if (err) setError(err);
                }}
              >
                Continue with Google
              </Button>
              {error && <div style={{ fontSize: 12, color: "var(--reach)" }}>{error}</div>}
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                No passwords. Your current session merges into the account automatically.
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

type TradePayload = TradeEvaluation & { myRosterId?: number };
type RecapPayload = {
  draftId?: string;
  grade?: string;
  totalVbd?: number;
  steal?: number;
  bestPick?: { name: string; label: string };
  biggestReach?: { name: string; label: string };
  season?: string;
};

export function HistoryDrawer({ leagueId, onClose }: { leagueId?: string; onClose: () => void }) {
  const [tab, setTab] = React.useState("TRADES");
  const [items, setItems] = React.useState<HistoryItem[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    authFetch(`/api/history${leagueId ? `?league=${encodeURIComponent(leagueId)}` : ""}`)
      .then((r) => r.json())
      .then((d: { items?: HistoryItem[] }) => {
        if (!cancelled) setItems(d.items ?? []);
      })
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const trades = (items ?? []).filter((i) => i.kind === "trade_eval");
  const recaps = (items ?? []).filter((i) => i.kind === "draft_recap");
  const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(11,14,17,.6)", zIndex: 110, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: "100%",
          height: "100%",
          background: "var(--surface-panel)",
          borderLeft: "1px solid var(--line-1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--line-1)" }}>
          <span style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 850, fontSize: 16 }}>HISTORY</span>
          <span style={{ flex: 1 }} />
          <Tabs size="sm" items={["TRADES", "DRAFT"]} value={tab} onChange={setTab} />
          <IconButton label="Close" size="sm" onClick={onClose}>
            <span style={{ fontSize: 12 }}>✕</span>
          </IconButton>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {tab === "TRADES" &&
            (trades.length ? (
              trades.map((t) => {
                const p = t.payload as unknown as TradePayload;
                const mine = p.teams?.find((x) => x.rosterId === p.myRosterId) ?? p.teams?.[0];
                return (
                  <Card key={t.id} pad={false}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--line-1)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>{day(t.createdAt)}</span>
                      <span style={{ flex: 1 }} />
                      {mine && <StatDelta value={mine.valueDelta} suffix=" val" />}
                      <Tag tone={p.realistic ? "value" : "reach"}>{p.realistic ? "REALISTIC" : "UNREALISTIC"}</Tag>
                    </div>
                    <div style={{ display: "flex", padding: "10px 12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", color: "var(--text-faint)", marginBottom: 6 }}>
                          YOU SEND
                        </div>
                        {(mine?.gives ?? []).map((n) => (
                          <div key={n} style={{ fontSize: 12, marginBottom: 4 }}>
                            {n}
                          </div>
                        ))}
                      </div>
                      <div style={{ alignSelf: "center", color: "var(--text-faint)", padding: "0 10px", fontFamily: "var(--font-mono)" }}>⇄</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", color: "var(--text-faint)", marginBottom: 6 }}>
                          YOU RECEIVE
                        </div>
                        {(mine?.receives ?? []).map((n) => (
                          <div key={n} style={{ fontSize: 12, marginBottom: 4 }}>
                            {n}
                          </div>
                        ))}
                      </div>
                    </div>
                    {p.summary && (
                      <div style={{ padding: "0 12px 10px", fontSize: 12, color: "var(--text-muted)" }}>{p.summary}</div>
                    )}
                  </Card>
                );
              })
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                {items == null ? "Loading…" : "No trade evaluations yet — run one from the Advisor tab."}
              </div>
            ))}
          {tab === "DRAFT" &&
            (recaps.length ? (
              recaps.map((r) => {
                const p = r.payload as RecapPayload;
                return (
                  <Card key={r.id} title={`Draft recap${p.season ? ` · ${p.season}` : ""}`}>
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                      {[
                        ["GRADE", p.grade ?? "—"],
                        ["VALUE VS ADP", p.steal != null ? `+${p.steal}` : "—"],
                        ["VBD", p.totalVbd != null ? `+${p.totalVbd}` : "—"],
                        ["BEST PICK", p.bestPick ? `${p.bestPick.name} ${p.bestPick.label}` : "—"],
                        ["BIGGEST REACH", p.biggestReach ? `${p.biggestReach.name} ${p.biggestReach.label}` : "—"],
                      ].map(([l, v]) => (
                        <div key={l}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", color: "var(--text-faint)" }}>{l}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
                      Snapshotted when the draft completed. Full pick-by-pick grades live in the draft room.
                    </div>
                  </Card>
                );
              })
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                {items == null ? "Loading…" : "No draft recaps yet — they snapshot automatically when a draft completes."}
              </div>
            ))}
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line-1)", fontSize: 11, color: "var(--text-faint)" }}>
          History follows your session — sign in to keep it across browsers.
        </div>
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, "accent" | "value" | "neutral"> = {
  drafting: "accent",
  pre_draft: "neutral",
  in_season: "value",
  complete: "neutral",
};

/** Landing card: pick up where you left off. Works anonymously via sid. */
export function RecentLeagues() {
  const router = useRouter();
  const [leagues, setLeagues] = React.useState<RecentLeague[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    authFetch("/api/leagues/recent")
      .then((r) => r.json())
      .then((d: { leagues?: RecentLeague[] }) => {
        if (!cancelled) setLeagues(d.leagues ?? []);
      })
      .catch(() => !cancelled && setLeagues([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const forget = (leagueId: string) => {
    setLeagues((ls) => (ls ?? []).filter((l) => l.leagueId !== leagueId));
    authFetch(`/api/leagues/recent?league=${encodeURIComponent(leagueId)}`, { method: "DELETE" }).catch(() => {});
  };

  if (!leagues?.length) return null;

  return (
    <Card title="Recent leagues" pad={false} style={{ width: "100%", maxWidth: 480 }}>
      {leagues.map((l) => {
        const dest = l.status === "drafting" || l.status === "pre_draft" ? `/league/${l.leagueId}/draft` : `/league/${l.leagueId}`;
        return (
          <div
            key={l.leagueId}
            onClick={() => router.push(dest)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderBottom: "1px solid var(--line-1)",
              cursor: "pointer",
              transition: "background var(--dur-fast)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.name ?? l.leagueId}
                </span>
                {l.status && (
                  <Tag tone={STATUS_TONE[l.status] ?? "neutral"}>{l.status.replace("_", "-").toUpperCase()}</Tag>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, fontSize: 11, color: "var(--text-faint)", flexWrap: "wrap" }}>
                {l.season && <span style={{ fontFamily: "var(--font-mono)" }}>{l.season}</span>}
                {l.teams != null && <span>· {l.teams} teams</span>}
                {l.scoring && <span>· {l.scoring}</span>}
                {l.superflex && <span>· Superflex</span>}
                {l.teamName && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "var(--bg-3)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: 7,
                        fontWeight: 700,
                      }}
                    >
                      {teamInitials(l.teamName)}
                    </span>
                    {l.teamName}
                  </span>
                )}
              </div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>→</span>
            <IconButton
              label="Forget league"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                forget(l.leagueId);
              }}
            >
              <span style={{ fontSize: 12 }}>✕</span>
            </IconButton>
          </div>
        );
      })}
    </Card>
  );
}
