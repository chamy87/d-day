import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sleeper } from "@/lib/sleeper";
import { activeProvider, aiReason } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export type TradeRequest = {
  teams: { rosterId: number; sends: { playerId: string; toRosterId: number }[] }[];
};

export type TradeEvaluation = {
  teams: {
    rosterId: number;
    teamName: string;
    gives: string[];
    receives: string[];
    valueOut: number;
    valueIn: number;
    valueDelta: number;
    benefit: string;
    concerns: string;
  }[];
  realistic: boolean;
  fairness: string;
  angle: string;
  summary: string;
};

/**
 * Multi-team (2–3) trade evaluation: deterministic FantasyCalc value math
 * plus AI reasoning on fit, timing, and the pitch angle for each side.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{10,20}$/.test(id)) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }
  if (!activeProvider()) {
    return NextResponse.json({ error: "No AI provider configured." }, { status: 503 });
  }

  let body: TradeRequest;
  try {
    body = (await req.json()) as TradeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const teams = body.teams ?? [];
  if (teams.length < 2 || teams.length > 3) {
    return NextResponse.json({ error: "A trade involves 2 or 3 teams." }, { status: 400 });
  }
  const totalSent = teams.reduce((n, t) => n + (t.sends?.length ?? 0), 0);
  if (totalSent < 2 || totalSent > 10) {
    return NextResponse.json({ error: "Each side needs to send something (2–10 players total)." }, { status: 400 });
  }
  const rosterIds = new Set(teams.map((t) => t.rosterId));
  for (const t of teams) {
    for (const s of t.sends ?? []) {
      if (!rosterIds.has(s.toRosterId) || s.toRosterId === t.rosterId) {
        return NextResponse.json({ error: "Every sent player must go to another involved team." }, { status: 400 });
      }
    }
  }

  const [league, rosters, users, state] = await Promise.all([
    sleeper.league(id),
    sleeper.leagueRosters(id),
    sleeper.leagueUsers(id),
    sleeper.state(),
  ]);
  if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });

  const db = supabaseAdmin();
  const numQbs = league.roster_positions.includes("SUPER_FLEX") ? 2 : 1;
  const rec = league.scoring_settings?.rec ?? 0;
  const ppr = rec >= 1 ? 1 : rec >= 0.5 ? 0.5 : 0;

  const involved = teams.map((t) => {
    const roster = rosters.find((r) => r.roster_id === t.rosterId);
    if (!roster) throw new Error(`Roster ${t.rosterId} not found`);
    for (const s of t.sends) {
      if (!(roster.players ?? []).includes(s.playerId)) {
        throw new Error(`Player ${s.playerId} is not on roster ${t.rosterId}`);
      }
    }
    return { ...t, roster };
  });

  const allIds = involved.flatMap((t) => t.roster.players ?? []);
  const [playersRes, valuesRes] = await Promise.all([
    db.from("players").select("sleeper_id,name,team,pos,status").in("sleeper_id", allIds),
    db.from("values_fc").select("sleeper_id,value,trend30,age").eq("num_qbs", numQbs).eq("ppr", ppr).in("sleeper_id", allIds),
  ]);
  const pById = new Map((playersRes.data ?? []).map((p) => [p.sleeper_id, p]));
  const vById = new Map((valuesRes.data ?? []).map((v) => [v.sleeper_id, v]));

  const nameOf = (pid: string) => pById.get(pid)?.name ?? pid;
  const valueOf = (pid: string) => vById.get(pid)?.value ?? 0;
  const describe = (pid: string) => {
    const p = pById.get(pid);
    const v = vById.get(pid);
    return `${p?.pos ?? "?"} ${p?.name ?? pid} (${p?.team ?? "FA"}) value ${v?.value ?? "?"} trend30 ${v?.trend30 ?? "?"} age ${v?.age ?? "?"}${p?.status ? ` [${p.status}]` : ""}`;
  };
  const teamNameOf = (rosterId: number) => {
    const r = rosters.find((x) => x.roster_id === rosterId);
    const u = users.find((x) => x.user_id === r?.owner_id);
    return u?.metadata?.team_name ?? u?.display_name ?? `Team ${rosterId}`;
  };

  // Deterministic value math per team.
  const math = involved.map((t) => {
    const gives = t.sends.map((s) => s.playerId);
    const receives = involved
      .flatMap((o) => o.sends)
      .filter((s) => s.toRosterId === t.rosterId)
      .map((s) => s.playerId);
    const valueOut = gives.reduce((n, pid) => n + valueOf(pid), 0);
    const valueIn = receives.reduce((n, pid) => n + valueOf(pid), 0);
    return { rosterId: t.rosterId, teamName: teamNameOf(t.rosterId), gives, receives, valueOut, valueIn, valueDelta: valueIn - valueOut };
  });

  const teamBlocks = involved
    .map((t) => {
      const m = math.find((x) => x.rosterId === t.rosterId)!;
      return `TEAM "${m.teamName}" (roster ${t.rosterId}):
  full roster: ${(t.roster.players ?? []).map((pid) => `${pById.get(pid)?.pos ?? "?"} ${nameOf(pid)}`).join(", ")}
  GIVES: ${m.gives.map(describe).join(" | ") || "(nothing)"}
  RECEIVES: ${m.receives.map(describe).join(" | ") || "(nothing)"}
  value out ${m.valueOut}, value in ${m.valueIn}, net ${m.valueDelta >= 0 ? "+" : ""}${m.valueDelta}`;
    })
    .join("\n\n");

  const system = `You are D-Day, a terse tactical fantasy football trade analyst. Voice: second person toward the proposing team, numbers lead, no hype, no emoji. Judge trades on roster fit and positional needs, market value and 30-day trend, age curves (RB ~27+, WR ~30+), tiers, bye overlap, and injury risk — not raw value alone. Be reasonable: a trade where one side clearly loses is unrealistic and you must say so. The first team listed is the user proposing the trade; look out for their interest but keep the pitch honest and mutually defensible. Output ONLY JSON: {"teams":[{"rosterId":n,"benefit":"...","concerns":"..."}],"realistic":true|false,"fairness":"balanced"|"slightly favors <team>"|"lopsided toward <team>","angle":"how to pitch it to the other side(s), one or two sentences","summary":"one sentence verdict"} — each benefit/concern is one clause under 160 chars.`;

  const prompt = `${league.season} season, week ${state.week}. Scoring rec=${rec}, ${numQbs}QB league.

PROPOSED TRADE:
${teamBlocks}

Evaluate this trade for every side.`;

  let ai: { teams: { rosterId: number; benefit: string; concerns: string }[]; realistic: boolean; fairness: string; angle: string; summary: string };
  try {
    const raw = await aiReason(prompt, system);
    const jsonText = raw.replace(/```json|```/g, "").trim();
    ai = JSON.parse(jsonText.slice(jsonText.indexOf("{"), jsonText.lastIndexOf("}") + 1));
  } catch {
    return NextResponse.json({ error: "AI unavailable — try again later." }, { status: 502 });
  }

  const result: TradeEvaluation = {
    teams: math.map((m) => {
      const a = (ai.teams ?? []).find((t) => t.rosterId === m.rosterId);
      return {
        ...m,
        gives: m.gives.map(nameOf),
        receives: m.receives.map(nameOf),
        benefit: a?.benefit ?? "",
        concerns: a?.concerns ?? "",
      };
    }),
    realistic: !!ai.realistic,
    fairness: String(ai.fairness ?? ""),
    angle: String(ai.angle ?? ""),
    summary: String(ai.summary ?? ""),
  };

  return NextResponse.json(result);
}
