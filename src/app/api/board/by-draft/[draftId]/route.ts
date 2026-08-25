import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sleeper, scoringLabel, presetScoring, draftRosterPositions } from "@/lib/sleeper";
import { buildBoard } from "@/lib/board";
import type { BoardResponse } from "../../[leagueId]/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Board for a draft without a league — Sleeper mock drafts. Scoring comes
 * from the draft's scoring_type preset; roster shape from its slots_*.
 */
export async function GET(req: Request, ctx: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await ctx.params;
  const refresh = new URL(req.url).searchParams.has("refresh");
  if (!/^\d{10,20}$/.test(draftId)) {
    return NextResponse.json({ error: "Invalid draft id." }, { status: 400 });
  }

  const draft = await sleeper.draft(draftId).catch(() => null);
  if (!draft) return NextResponse.json({ error: "Draft not found on Sleeper." }, { status: 404 });

  const scoringSettings = presetScoring(draft.metadata?.scoring_type);
  const rosterPositions = draftRosterPositions(draft.settings);
  const teams = draft.settings.teams;
  const { season } = await sleeper.state();

  try {
    const built = await buildBoard(supabaseAdmin(), { scoringSettings, rosterPositions, teams }, refresh);
    return NextResponse.json({
      league: {
        leagueId: draft.league_id,
        name: draft.metadata?.name || "Mock draft",
        season,
        status: draft.status,
        teams,
        scoring: scoringLabel(scoringSettings.rec),
        superflex: rosterPositions.includes("SUPER_FLEX"),
        rosterPositions,
        draftId: draft.draft_id,
      },
      users: [],
      ...built,
    } satisfies BoardResponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Board unavailable." }, { status: 503 });
  }
}
