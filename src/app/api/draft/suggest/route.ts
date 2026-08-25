import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { activeProvider, aiReason, currentModel } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type SuggestRequest = {
  leagueName?: string;
  scoring: string; // "PPR" | "Half PPR" | "Standard" | custom
  superflex: boolean;
  remainingPicks: number | null;
  roster: { slot: string; player: string | null; pos: string | null }[];
  candidates: {
    sleeperId: string;
    name: string;
    pos: string;
    team: string | null;
    vbd: number;
    adp: number | null;
    adpDelta: number | null;
    tier: number;
    fc: number | null;
    injury: string | null;
  }[];
};

export type SuggestResponse = {
  picks: { name: string; why: string }[];
  strategy: string;
  model: string | null;
};

/**
 * On-demand AI second opinion for the draft room's suggested pick — reasons
 * over the live roster state, league type, remaining picks, and nflfastR
 * multi-season history for the candidates. Explicit user action, no cache.
 */
export async function POST(req: Request) {
  const provider = activeProvider();
  if (!provider) return NextResponse.json({ error: "No AI provider configured." }, { status: 503 });

  let body: SuggestRequest;
  try {
    body = (await req.json()) as SuggestRequest;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const candidates = (body.candidates ?? []).slice(0, 14);
  if (!candidates.length || !Array.isArray(body.roster)) {
    return NextResponse.json({ error: "roster and candidates are required." }, { status: 400 });
  }

  // Enrich candidates with historical trajectories (nflverse/nflfastR).
  const db = supabaseAdmin();
  const { data: hist } = await db
    .from("player_seasons")
    .select("sleeper_id,season,ppg,games,stats")
    .in("sleeper_id", candidates.map((c) => c.sleeperId))
    .order("season", { ascending: false });
  const histById = new Map<string, string[]>();
  for (const h of hist ?? []) {
    const list = histById.get(h.sleeper_id) ?? [];
    if (list.length < 3) {
      const share = (h.stats as { target_share?: number } | null)?.target_share;
      list.push(`${h.season}:${h.ppg}ppg/${h.games}g${share ? `/${Math.round(share * 100)}%tgt` : ""}`);
    }
    histById.set(h.sleeper_id, list);
  }

  const rosterBlock = body.roster
    .map((s) => `${s.slot}: ${s.player ? `${s.pos ?? ""} ${s.player}` : "EMPTY"}`)
    .join("\n");
  const candBlock = candidates
    .map((c) => {
      const h = histById.get(c.sleeperId)?.join(" ") ?? "";
      return `${c.pos} ${c.name} (${c.team ?? "FA"}) vbd ${c.vbd} adp ${c.adp ?? "?"} tier ${c.tier}${c.fc != null ? ` value ${c.fc}` : ""}${c.injury ? ` [${c.injury}]` : ""}${h ? ` hist[${h}]` : ""}`;
    })
    .join("\n");

  const system = `You are D-Day, a terse tactical co-drafter on the clock. Voice: second person, numbers lead, one clause per reason, no hype, no emoji. Roster construction rules: you can only START one player per non-flex slot — a second TE or a second QB in a 1QB league adds almost no lineup value while starting slots sit empty; scoring type tilts value (PPR/half-PPR favor pass-catchers, standard favors rushing volume); tiers mark interchangeability; a player's multi-season hist[] (nflverse ppg/games/target share) reveals trajectory and durability. If remaining picks barely cover empty starting slots, fill needs. Pick ONLY from the given candidates. Output ONLY JSON: {"picks":[{"name","why"}] (exactly 3, best first, why under 120 chars), "strategy":"one clause on your draft state under 140 chars"}.`;

  const prompt = `League: ${body.leagueName ?? "draft"} — ${body.scoring}${body.superflex ? ", superflex" : ""}. Remaining picks for me: ${body.remainingPicks ?? "?"}.

MY ROSTER:
${rosterBlock}

CANDIDATES (best available):
${candBlock}

Who should I draft next, and why?`;

  try {
    const raw = await aiReason(prompt, system);
    const jsonText = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonText.slice(jsonText.indexOf("{"), jsonText.lastIndexOf("}") + 1)) as {
      picks: { name: string; why: string }[];
      strategy: string;
    };
    const names = new Set(candidates.map((c) => c.name));
    const picks = (parsed.picks ?? []).filter((p) => names.has(p.name)).slice(0, 3);
    const model = await currentModel(provider).catch(() => null);
    return NextResponse.json({
      picks,
      strategy: String(parsed.strategy ?? "").slice(0, 200),
      model,
    } satisfies SuggestResponse);
  } catch {
    return NextResponse.json({ error: "AI unavailable — try again." }, { status: 502 });
  }
}
