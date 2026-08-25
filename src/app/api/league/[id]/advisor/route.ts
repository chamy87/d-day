import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sleeper } from "@/lib/sleeper";
import { scoreProjection } from "@/lib/vbd";
import { bcScoring, normalizeName } from "@/lib/ingest";
import { activeProvider, aiReason, currentModel } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TTL_MS = 12 * 60 * 60 * 1000;

export type AdvisorPlayer = {
  id: string;
  name: string;
  pos: string;
  team: string | null;
  age: number | null;
  value: number | null;
  trend30: number | null;
  tier: number | null;
  proj: number | null;
  injury: string | null;
};

export type AdvisorAdvice = {
  sell: { name: string; reason: string }[];
  acquire: { name: string; owner: string; reason: string }[];
  summary: string;
};

/**
 * Sell-high / buy-low analysis for one roster: market value + 30-day trend +
 * age + tier + projection + recent news, reasoned over by the AI in the
 * brand voice. Cached 12h per (league, roster).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const rosterId = Number(url.searchParams.get("roster"));
  const refresh = url.searchParams.has("refresh");
  if (!/^\d{10,20}$/.test(id) || !(rosterId >= 1)) {
    return NextResponse.json({ error: "league and roster are required." }, { status: 400 });
  }
  if (!activeProvider()) {
    return NextResponse.json({ error: "No AI provider configured." }, { status: 503 });
  }

  const db = supabaseAdmin();
  if (!refresh) {
    const { data: cached } = await db
      .from("ai_advice")
      .select("advice,updated_at")
      .eq("league_id", id)
      .eq("roster_id", rosterId)
      .eq("kind", "advisor")
      .maybeSingle();
    if (cached && Date.now() - new Date(cached.updated_at).getTime() < TTL_MS) {
      return NextResponse.json({ ...(cached.advice as object), cached: true });
    }
  }

  const [league, rosters, users, state] = await Promise.all([
    sleeper.league(id),
    sleeper.leagueRosters(id),
    sleeper.leagueUsers(id),
    sleeper.state(),
  ]);
  if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });
  const mine = rosters.find((r) => r.roster_id === rosterId);
  if (!mine) return NextResponse.json({ error: "Roster not found." }, { status: 404 });

  const numQbs = league.roster_positions.includes("SUPER_FLEX") ? 2 : 1;
  const rec = league.scoring_settings?.rec ?? 0;
  const ppr = rec >= 1 ? 1 : rec >= 0.5 ? 0.5 : 0;
  const bucket = bcScoring(rec);

  const allIds = rosters.flatMap((r) => r.players ?? []);
  const [playersRes, valuesRes, projRes, tiersRes] = await Promise.all([
    db.from("players").select("sleeper_id,name,team,pos,bye,status").in("sleeper_id", allIds),
    db.from("values_fc").select("sleeper_id,value,trend30,age,pos_rank").eq("num_qbs", numQbs).eq("ppr", ppr).in("sleeper_id", allIds),
    db.from("projections").select("sleeper_id,stats").eq("season", Number(state.season)).eq("week", 0).in("sleeper_id", mine.players ?? []),
    db.from("tiers").select("pos,tier,player_name").eq("scoring", bucket),
  ]);
  const pById = new Map((playersRes.data ?? []).map((p) => [p.sleeper_id, p]));
  const vById = new Map((valuesRes.data ?? []).map((v) => [v.sleeper_id, v]));
  const projById = new Map((projRes.data ?? []).map((r) => [r.sleeper_id, r.stats as Record<string, number>]));
  const tierByKey = new Map((tiersRes.data ?? []).map((t) => [`${normalizeName(t.player_name)}:${t.pos}`, t.tier]));

  const describe = (pid: string, withProj = false): AdvisorPlayer | null => {
    const p = pById.get(pid);
    if (!p) return null;
    const v = vById.get(pid);
    const stats = withProj ? projById.get(pid) : undefined;
    return {
      id: pid,
      name: p.name,
      pos: p.pos,
      team: p.team,
      age: v?.age ?? null,
      value: v?.value ?? null,
      trend30: v?.trend30 ?? null,
      tier: tierByKey.get(`${normalizeName(p.name)}:${p.pos}`) ?? null,
      proj: stats ? scoreProjection(stats, league.scoring_settings ?? {}) : null,
      injury: p.status,
    };
  };

  const myPlayers = (mine.players ?? []).map((pid) => describe(pid, true)).filter(Boolean) as AdvisorPlayer[];
  myPlayers.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const teamName = (r: (typeof rosters)[number]) => {
    const u = users.find((x) => x.user_id === r.owner_id);
    return u?.metadata?.team_name ?? u?.display_name ?? `Team ${r.roster_id}`;
  };

  const line = (p: AdvisorPlayer) =>
    `${p.pos} ${p.name} (${p.team ?? "FA"}) age ${p.age ?? "?"} value ${p.value ?? "?"} trend30 ${p.trend30 ?? "?"} tier ${p.tier ?? "?"}${p.proj != null ? ` proj ${p.proj}` : ""}${p.injury ? ` [${p.injury}]` : ""}`;

  const others = rosters
    .filter((r) => r.roster_id !== rosterId)
    .map((r) => {
      const tops = (r.players ?? [])
        .map((pid) => describe(pid))
        .filter(Boolean)
        .sort((a, b) => (b!.value ?? 0) - (a!.value ?? 0))
        .slice(0, 8) as AdvisorPlayer[];
      return `${teamName(r)}:\n${tops.map((p) => "  " + line(p)).join("\n")}`;
    })
    .join("\n");

  const { data: newsRows } = await db
    .from("news_cache")
    .select("title,source,published_at")
    .overlaps("player_ids", mine.players ?? [])
    .gte("published_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("published_at", { ascending: false })
    .limit(15);
  const newsBlock = (newsRows ?? []).map((n) => `- ${n.title} (${n.source})`).join("\n") || "(none this week)";

  const system = `You are D-Day, a terse tactical fantasy football advisor. Voice: second person, numbers lead, no hype, no emoji. Weigh market value, 30-day value trend, age relative to positional aging curves (RBs decline ~27+, WRs ~30+, QBs/TEs later), team situation, position tier, projection, injuries, and recent news. Be reasonable — only flag moves a sane leaguemate might actually accept. Output ONLY JSON: {"sell":[{"name","reason"}],"acquire":[{"name","owner","reason"}],"summary":"..."} with at most 3 sells and 3 acquires; each reason is one clause under 140 chars naming the strongest signal (trend, age, tier, news).`;

  const prompt = `${league.season} season, week ${state.week}. Scoring rec=${rec}, ${numQbs}QB league.

MY ROSTER (full detail):
${myPlayers.map(line).join("\n")}

RECENT NEWS ON MY PLAYERS:
${newsBlock}

OTHER TEAMS (top holdings — acquire candidates must come from these):
${others}

Identify my best sell-high candidates (value likely to fall: aging, unsustainable trend, bad situation, injury cloud) and realistic buy-low targets on other teams (value likely to rise: young, positive trend, strong situation, tier above their price).`;

  let advice: AdvisorAdvice;
  try {
    const raw = await aiReason(prompt, system);
    const jsonText = raw.replace(/```json|```/g, "").trim();
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    advice = JSON.parse(jsonText.slice(start, end + 1)) as AdvisorAdvice;
    advice = {
      sell: (advice.sell ?? []).slice(0, 3),
      acquire: (advice.acquire ?? []).slice(0, 3),
      summary: String(advice.summary ?? "").slice(0, 300),
    };
  } catch {
    return NextResponse.json({ error: "AI unavailable — try again later." }, { status: 502 });
  }

  const provider = activeProvider()!;
  const model = await currentModel(provider).catch(() => null);
  const payload = { advice, myPlayers, generatedAt: new Date().toISOString() };
  await db
    .from("ai_advice")
    .upsert({ league_id: id, roster_id: rosterId, kind: "advisor", advice: payload, model, updated_at: new Date().toISOString() })
    .then(() => undefined, () => undefined);

  return NextResponse.json({ ...payload, cached: false });
}
