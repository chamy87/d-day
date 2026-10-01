import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computeNeeds } from "@/lib/needs";
import { planLineup, type LineupPlayer } from "@/lib/lineup";
import { positionStrength, type RatedPlayer } from "@/lib/roster-needs";
import { activeProvider, aiReason, currentModel } from "@/lib/ai";
import { sleeper, weekStarters } from "@/lib/sleeper";
import { scoreProjection } from "@/lib/vbd";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TTL_MS = 3 * 60 * 60 * 1000;

export type GamePlan = {
  headline: string;
  lineup: string;
  /** Keyed to the deterministic trade ideas by target player id. */
  trades: { targetId: string; case: string; pitch: string }[];
  stash: { id: string; note: string }[];
  waivers: string;
  watch: string;
};

export type GamePlanResponse = { plan: GamePlan; generatedAt: string; model: string | null; cached: boolean };

/**
 * The weekly game plan in words: the AI reads the deterministic engine's
 * output (lineup verdict, roster balance, trade simulations for both sides,
 * stashes, waivers) plus recent headlines, and writes the case for each move
 * and the pitch to send the other manager. It never invents numbers.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const rosterId = Number(url.searchParams.get("roster"));
  if (!/^\d{10,20}$/.test(id) || !(rosterId >= 1)) {
    return NextResponse.json({ error: "league and roster are required." }, { status: 400 });
  }
  const provider = activeProvider();
  if (!provider) return NextResponse.json({ error: "No AI provider configured." }, { status: 503 });

  const db = supabaseAdmin();
  const res = await computeNeeds(db, id, rosterId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  const { data: needs, ctx: c } = res;
  const P = (pid: string): RatedPlayer | undefined => c.byId.get(pid);
  const starters = weekStarters(c.mine, await sleeper.matchups(id, needs.week).catch(() => []));
  const extraName = (pid: string) => extraNames.get(pid);
  const name = (pid: string) => P(pid)?.name ?? extraName(pid) ?? pid;

  // Recompute when the roster, lineup, or the idea set changes — not just on a timer.
  const signature = [
    needs.week,
    [...(c.mine.players ?? [])].sort().join(","),
    starters.join(","),
    needs.trades.map((t) => `${t.target}:${t.send.join("+")}`).join("|"),
    needs.stash.map((s) => s.id).join(","),
    needs.seasonOut.map((s) => s.id).join(","),
  ].join("#");
  if (!url.searchParams.has("refresh")) {
    const { data: cached } = await db
      .from("ai_advice")
      .select("advice,updated_at,model")
      .eq("league_id", id)
      .eq("roster_id", rosterId)
      .eq("kind", "gameplan")
      .maybeSingle();
    const adv = cached?.advice as { plan: GamePlan; signature: string } | undefined;
    if (cached && adv?.signature === signature && Date.now() - new Date(cached.updated_at).getTime() < TTL_MS) {
      return NextResponse.json({ plan: adv.plan, generatedAt: cached.updated_at, model: cached.model, cached: true } satisfies GamePlanResponse);
    }
  }

  // This week's lineup verdict from the same optimizer the START/SIT tab uses.
  const byLineup: Record<string, LineupPlayer> = {};
  for (const pid of c.mine.players ?? []) {
    const p = P(pid);
    if (p) byLineup[pid] = { id: pid, pos: p.pos, proj: p.weekProj, injury: p.injury, onBye: !!p.team && !p.opp && p.weekProj != null };
  }
  // K/DEF aren't in the skill-position ratings — add them so every slot is real.
  const missing = (c.mine.players ?? []).filter((pid) => !byLineup[pid]);
  const extraNames = new Map<string, string>();
  if (missing.length) {
    const [{ data: xp }, { data: xproj }] = await Promise.all([
      db.from("players").select("sleeper_id,name,pos,team,status").in("sleeper_id", missing),
      db.from("projections").select("sleeper_id,stats,opponent").eq("season", Number(c.league.season)).eq("week", needs.week).in("sleeper_id", missing),
    ]);
    const projBy = new Map((xproj ?? []).map((r) => [r.sleeper_id, r]));
    for (const p of xp ?? []) {
      const row = projBy.get(p.sleeper_id);
      extraNames.set(p.sleeper_id, p.name);
      byLineup[p.sleeper_id] = {
        id: p.sleeper_id,
        pos: p.pos,
        proj: row ? scoreProjection(row.stats as Record<string, number>, c.league.scoring_settings ?? {}) : null,
        injury: p.status,
        onBye: !!p.team && !!row && !row.opponent,
      };
    }
  }
  const reserve = new Set(c.mine.reserve ?? []);
  const plan = planLineup(
    c.league.roster_positions,
    starters,
    (c.mine.players ?? []).filter((pid) => !reserve.has(pid)),
    byLineup,
  );

  const line = (p: RatedPlayer) => {
    const hist = (p.hist ?? []).map((h) => `${h.season}:${h.ppg}ppg/${h.games}g`).join(" ");
    return `${p.pos} ${p.name} (${p.team ?? "NO TEAM"}${p.age ? `, age ${p.age}` : ""}) rate ${p.rate}/g${p.ytdPpg != null ? `, ${p.ytdPpg}ppg in ${p.gp}g this season` : ""}${p.injury ? ` [${p.injury}${p.injuryDetail ? `: ${p.injuryDetail}` : ""}]` : ""}${p.outlook === "SEASON" || p.outlook === "LONG" ? ` [OUT FOR SEASON${p.outlook === "LONG" ? " (presumed)" : ""}${p.outlookReason ? ` — "${p.outlookReason}"` : ""}]` : ""}${p.value != null ? `, value ${p.value}` : ""}${p.trend30 ? ` (30d ${p.trend30 > 0 ? "+" : ""}${p.trend30})` : ""}${hist ? ` hist[${hist}]` : ""}`;
  };

  const balance = needs.strength
    .map((s) => `${s.pos}: ${s.label}, rank ${s.rank}/${s.teams}, ${s.gap >= 0 ? "+" : ""}${s.gap}/g vs avg${s.surplus.length ? `, surplus ${s.surplus.map((x) => name(x.id)).join("/")}` : ""}`)
    .join("\n");
  const lineupBlock = [
    `Set ${plan.currentTotal} expected pts, best ${plan.optimalTotal}.`,
    ...plan.moves.map((m) => `MOVE: start ${name(m.start)} over ${m.bench ? name(m.bench) : "empty slot"} (+${m.gain})`),
    ...plan.alerts.map((a) => `ALERT ${a.kind}: ${a.playerId ? name(a.playerId) : a.slot}${a.pivot ? `, pivot ${name(a.pivot)}` : ""}`),
  ]
    .filter(Boolean)
    .join("\n");
  const tradeBlock = needs.trades
    .slice(0, 4)
    .map((t) => {
      const partnerStr = positionStrength(c.league.roster_positions, c.teams, t.partnerRosterId, c.byId)
        .map((s) => `${s.pos} ${s.label} #${s.rank}`)
        .join(", ");
      return `IDEA target=${t.target}: GET ${line(P(t.target)!)} from "${t.partner}" FOR ${t.send.map((sid) => line(P(sid)!)).join(" + ")}
  simulated best-lineup change: you ${t.myGain >= 0 ? "+" : ""}${t.myGain}/g, them ${t.theirGain >= 0 ? "+" : ""}${t.theirGain}/g; market ${t.targetValue} vs ${t.sendValueAdj} (max offer ${t.maxValue})
  their roster balance: ${partnerStr}`;
    })
    .join("\n");
  const stashBlock = needs.stash
    .map((s) => {
      const p = P(s.id)!;
      return `STASH id=${s.id} ${s.kind} (${s.where}): ${line(p)}; if back ~${s.ifBack}/g → your lineup +${s.gainIfBack}/g${s.bidNow != null ? `; RECOMMENDED BID NOW $${s.bidNow} (speculative); for contrast, the price once healthy/signed would be ~$${s.bidLater} — never recommend the later price as the bid` : ""}${p.headline ? `; latest: "${p.headline}"` : ""}`;
    })
    .join("\n");
  const waiverBlock =
    needs.waivers
      .slice(0, 4)
      .map((w) => `${line(P(w.id)!)} → lineup ${w.gain > 0 ? `+${w.gain}/g, bid $${w.bid}` : "no gain (depth)"}${w.drop ? `, drop ${name(w.drop)}` : ""}`)
      .join("\n") || "(none)";
  const irBlock = needs.ir.map((m) => `${m.kind} ${name(m.playerId)}`).join("; ") || "none";

  const involved = [
    ...(c.mine.players ?? []),
    ...needs.trades.slice(0, 4).map((t) => t.target),
    ...needs.stash.map((s) => s.id),
  ];
  const { data: newsRows } = await db
    .from("news_cache")
    .select("title,source,player_ids")
    .overlaps("player_ids", involved)
    .gte("published_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("published_at", { ascending: false })
    .limit(20);
  const newsBlock = (newsRows ?? []).map((n) => `- ${n.title} (${n.source})`).join("\n") || "(none)";

  const system = `You are D-Day, a terse tactical fantasy football co-manager. Voice: second person, numbers lead, no hype, no emoji. All numbers below come from a deterministic engine (exact lineup optimizer, league-scored rates, FantasyCalc market values) — cite them, never invent or contradict them. Rate = expected pts/game. For trades, "case" is the objective reason it helps the user; "pitch" is the angle for the message the user sends the OTHER manager — written from that manager's interest (their simulated gain, their positional need, the value they receive), honest and specific, 1-2 sentences, ready to paste. A player marked OUT FOR SEASON will not play again this year: never suggest adding, stashing, or trading for him; if he's on the user's bench, call it a dead roster spot to cut; in an IR slot he costs nothing. For stashes, weigh track record (hist), age, news, and market trend; say plainly whether to hold/add and why. Output ONLY JSON: {"headline":"the single most important thing this week, <160 chars","lineup":"1-2 sentences","trades":[{"target":"<target id from IDEA target=>","case":"<200 chars","pitch":"<280 chars"}],"stash":[{"id":"<id from STASH id=>","note":"<200 chars"}],"waivers":"1-2 sentences","watch":"what to monitor before kickoff/waivers, 1 sentence"}`;

  const prompt = `${c.league.season} week ${needs.week}, ${needs.weeksLeft} weeks left. Scoring rec=${c.league.scoring_settings?.rec ?? 0}. FAAB: ${needs.faab ? `$${needs.faab.remaining}/${needs.faab.budget}` : "rolling waivers"}. IR slots ${needs.irSlots.used}/${needs.irSlots.total}; IR moves: ${irBlock}.

MY ROSTER:
${(c.mine.players ?? []).map((pid) => (P(pid) ? `${reserve.has(pid) ? "[IR SLOT] " : starters.includes(pid) ? "[STARTER] " : "[BENCH] "}${line(P(pid)!)}` : "")).filter(Boolean).join("\n")}

ROSTER BALANCE VS LEAGUE:
${balance}

THIS WEEK (optimizer):
${lineupBlock}

TRADE IDEAS (both rosters simulated):
${tradeBlock || "(none qualify)"}

STASHES:
${stashBlock || "(none)"}

WAIVERS:
${waiverBlock}

OUT FOR THE SEASON ON MY ROSTER: ${needs.seasonOut.map((x) => `${name(x.id)} (${x.where === "ir" ? "IR slot" : "BENCH — dead spot"})`).join(", ") || "none"}

RECENT NEWS:
${newsBlock}`;

  let plan_: GamePlan;
  try {
    const raw = await aiReason(prompt, system);
    const jsonText = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonText.slice(jsonText.indexOf("{"), jsonText.lastIndexOf("}") + 1)) as {
      headline?: string;
      lineup?: string;
      trades?: { target?: string; case?: string; pitch?: string }[];
      stash?: { id?: string; note?: string }[];
      waivers?: string;
      watch?: string;
    };
    const tradeIds = new Set(needs.trades.map((t) => t.target));
    const stashIds = new Set(needs.stash.map((s) => s.id));
    plan_ = {
      headline: String(parsed.headline ?? "").slice(0, 200),
      lineup: String(parsed.lineup ?? "").slice(0, 400),
      trades: (parsed.trades ?? [])
        .filter((t) => t.target && tradeIds.has(String(t.target)))
        .map((t) => ({ targetId: String(t.target), case: String(t.case ?? "").slice(0, 260), pitch: String(t.pitch ?? "").slice(0, 360) })),
      stash: (parsed.stash ?? [])
        .filter((s) => s.id && stashIds.has(String(s.id)))
        .map((s) => ({ id: String(s.id), note: String(s.note ?? "").slice(0, 260) })),
      waivers: String(parsed.waivers ?? "").slice(0, 400),
      watch: String(parsed.watch ?? "").slice(0, 300),
    };
  } catch {
    return NextResponse.json({ error: "AI unavailable — the numbers below still stand." }, { status: 502 });
  }

  const model = await currentModel(provider).catch(() => null);
  const generatedAt = new Date().toISOString();
  await db
    .from("ai_advice")
    .upsert({ league_id: id, roster_id: rosterId, kind: "gameplan", advice: { plan: plan_, signature }, model, updated_at: generatedAt })
    .then(() => undefined, () => undefined);

  return NextResponse.json({ plan: plan_, generatedAt, model, cached: false } satisfies GamePlanResponse);
}
