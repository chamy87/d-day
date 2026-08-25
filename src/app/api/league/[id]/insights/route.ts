import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sleeper } from "@/lib/sleeper";
import { scoreProjection } from "@/lib/vbd";
import { activeProvider, aiReason, currentModel } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TTL_MS = 6 * 60 * 60 * 1000;

export type Insight = { tone: "value" | "reach" | "neutral"; tag: string; text: string };

/** AI-written weekly flags for one roster. Cached per (league, roster, week). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const week = Number(url.searchParams.get("week"));
  const rosterId = Number(url.searchParams.get("roster"));
  if (!/^\d{10,20}$/.test(id) || !(week >= 1 && week <= 18) || !(rosterId >= 1)) {
    return NextResponse.json({ error: "league, roster and week are required." }, { status: 400 });
  }
  const provider = activeProvider();
  if (!provider) {
    return NextResponse.json({ insights: [], reason: "no AI provider configured" });
  }

  const db = supabaseAdmin();
  const { data: cached } = await db
    .from("ai_insights")
    .select("insights,updated_at")
    .eq("league_id", id)
    .eq("roster_id", rosterId)
    .eq("week", week)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.updated_at).getTime() < TTL_MS) {
    return NextResponse.json({ insights: cached.insights as Insight[], cached: true });
  }

  const [league, rosters, state] = await Promise.all([
    sleeper.league(id),
    sleeper.leagueRosters(id),
    sleeper.state(),
  ]);
  if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });
  const roster = rosters.find((r) => r.roster_id === rosterId);
  if (!roster) return NextResponse.json({ error: "Roster not found." }, { status: 404 });

  const ids = roster.players ?? [];
  const [{ data: players }, { data: projections }] = await Promise.all([
    db.from("players").select("sleeper_id,name,team,pos,bye,status").in("sleeper_id", ids),
    db
      .from("projections")
      .select("sleeper_id,stats")
      .eq("season", Number(state.season))
      .eq("week", week)
      .in("sleeper_id", ids),
  ]);
  const projById = new Map((projections ?? []).map((r) => [r.sleeper_id, r.stats as Record<string, number>]));
  const starters = new Set(roster.starters ?? []);
  const lines = (players ?? [])
    .map((p) => {
      const stats = projById.get(p.sleeper_id);
      const proj = stats ? scoreProjection(stats, league.scoring_settings ?? {}) : null;
      return `${starters.has(p.sleeper_id) ? "STARTER" : "BENCH"} ${p.pos} ${p.name} (${p.team ?? "FA"})${p.status ? ` [${p.status}]` : ""}${p.bye ? ` bye ${p.bye}` : ""} proj ${proj ?? "n/a"}`;
    })
    .join("\n");

  const system = `You are D-Day, a terse tactical fantasy football co-manager. Voice: second person, one clause per insight, numbers lead, no hype, no emoji. Output ONLY a JSON array (max 4 items) of {"tone":"value"|"reach"|"neutral","tag":"START"|"SIT"|"RISK"|"BYE"|"NOTE","text":"..."} — each text is a single clause under 120 characters.`;
  const prompt = `Week ${week}, ${league.season} season, scoring rec=${league.scoring_settings?.rec ?? 0}. My roster with projections:\n${lines}\n\nGive the 2-4 most decision-relevant start/sit flags for this week.`;

  let insights: Insight[] = [];
  try {
    const raw = await aiReason(prompt, system);
    const jsonText = raw.replace(/```json|```/g, "").trim();
    const start = jsonText.indexOf("[");
    const end = jsonText.lastIndexOf("]");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(jsonText.slice(start, end + 1)) as Insight[];
      insights = parsed
        .filter((i) => i && typeof i.text === "string")
        .slice(0, 4)
        .map((i) => ({
          tone: ["value", "reach", "neutral"].includes(i.tone) ? i.tone : "neutral",
          tag: String(i.tag ?? "NOTE").slice(0, 8).toUpperCase(),
          text: i.text.slice(0, 160),
        }));
    }
  } catch {
    return NextResponse.json({ insights: [], reason: "AI unavailable — try again later" });
  }

  const model = await currentModel(provider).catch(() => null);
  await db
    .from("ai_insights")
    .upsert({
      league_id: id,
      roster_id: rosterId,
      week,
      insights,
      model,
      updated_at: new Date().toISOString(),
    })
    .then(() => undefined, () => undefined);

  return NextResponse.json({ insights, cached: false });
}
