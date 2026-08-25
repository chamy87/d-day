import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sleeper, scoringLabel } from "@/lib/sleeper";
import { buildBoard } from "@/lib/board";
import type { Ranked } from "@/lib/vbd";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // cold path ingests the Sleeper players map

export type BoardResponse = {
  league: {
    leagueId: string | null;
    name: string;
    season: string;
    status: string;
    teams: number;
    scoring: string;
    superflex: boolean;
    rosterPositions: string[];
    draftId: string | null;
  };
  users: { userId: string; name: string; teamName: string | null }[];
  board: Ranked[];
  degraded: string[];
  generatedAt: string;
};

export async function GET(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;
  const refresh = new URL(req.url).searchParams.has("refresh");
  if (!/^\d{10,20}$/.test(leagueId)) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }

  const league = await sleeper.league(leagueId).catch(() => null);
  if (!league) return NextResponse.json({ error: "League not found on Sleeper." }, { status: 404 });

  const users = (await sleeper.leagueUsers(leagueId).catch(() => [])).map((u) => ({
    userId: u.user_id,
    name: u.display_name,
    teamName: u.metadata?.team_name ?? null,
  }));

  try {
    const built = await buildBoard(
      supabaseAdmin(),
      {
        scoringSettings: league.scoring_settings ?? {},
        rosterPositions: league.roster_positions,
        teams: league.total_rosters,
      },
      refresh,
    );
    return NextResponse.json({
      league: {
        leagueId: league.league_id,
        name: league.name,
        season: league.season,
        status: league.status,
        teams: league.total_rosters,
        scoring: scoringLabel(league.scoring_settings?.rec),
        superflex: league.roster_positions.includes("SUPER_FLEX"),
        rosterPositions: league.roster_positions,
        draftId: league.draft_id,
      },
      users,
      ...built,
    } satisfies BoardResponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Board unavailable." }, { status: 503 });
  }
}
