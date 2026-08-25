import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SLEEPER = process.env.SLEEPER_API_BASE ?? "https://api.sleeper.app/v1";

type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  status: string; // pre_draft | drafting | in_season | complete
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  draft_id: string | null;
};

export type LeagueSummary = {
  leagueId: string;
  name: string;
  season: string;
  status: string;
  teams: number;
  scoring: string;
  superflex: boolean;
  rosterPositions: string[];
  draftId: string | null;
};

function scoringLabel(rec: number | undefined): string {
  if (rec === 1) return "PPR";
  if (rec === 0.5) return "Half PPR";
  if (!rec) return "Standard";
  return `${rec} PPR`;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{10,20}$/.test(id)) {
    return NextResponse.json({ error: "That doesn't look like a Sleeper league ID." }, { status: 400 });
  }

  // Turnstile bot check — enforced only when the secret is configured.
  const turnstileSecret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const token = req.headers.get("x-turnstile-token");
    const fail = () =>
      NextResponse.json({ error: "Verification failed — reload and try again." }, { status: 403 });
    if (!token) return fail();
    try {
      const vr = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: turnstileSecret, response: token }),
      });
      const v = (await vr.json()) as { success: boolean };
      if (!v.success) return fail();
    } catch {
      return fail();
    }
  }

  const res = await fetch(`${SLEEPER}/league/${id}`, { next: { revalidate: 0 } });
  if (res.status === 404) {
    return NextResponse.json({ error: "League not found on Sleeper." }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "Sleeper is unreachable — try again." }, { status: 502 });
  }
  const league = (await res.json()) as SleeperLeague | null;
  if (!league) {
    return NextResponse.json({ error: "League not found on Sleeper." }, { status: 404 });
  }

  const summary: LeagueSummary = {
    leagueId: league.league_id,
    name: league.name,
    season: league.season,
    status: league.status,
    teams: league.total_rosters,
    scoring: scoringLabel(league.scoring_settings?.rec),
    superflex: league.roster_positions?.includes("SUPER_FLEX") ?? false,
    rosterPositions: league.roster_positions ?? [],
    draftId: league.draft_id,
  };

  // Best-effort cache; the lookup must work even if the schema isn't applied yet.
  try {
    await supabaseAdmin()
      .from("leagues_cache")
      .upsert({ league_id: league.league_id, settings: league, fetched_at: new Date().toISOString() });
  } catch {
    // degraded silently — cache only
  }

  return NextResponse.json(summary);
}
