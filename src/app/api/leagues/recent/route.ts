import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCaller, callerKey, withSidCookie } from "@/lib/identity";
import { scoringLabel } from "@/lib/sleeper";

export const dynamic = "force-dynamic";

export type RecentLeague = {
  leagueId: string;
  name: string | null;
  season: string | null;
  teamId: string | null;
  teamName: string | null;
  status: string | null;
  scoring: string | null;
  teams: number | null;
  superflex: boolean;
  lastSeen: string;
};

/** Leagues this caller has opened — anonymous via sid, durable via account. */
export async function GET(req: Request) {
  const caller = await getCaller(req);
  const key = callerKey(caller);
  const db = supabaseAdmin();
  const { data: rows } = await db
    .from("user_leagues")
    .select("league_id,league_name,season,team_id,last_seen")
    .eq(key.column, key.value)
    .order("last_seen", { ascending: false })
    .limit(8);

  const ids = (rows ?? []).map((r) => r.league_id);
  const cacheById = new Map<string, { settings: Record<string, unknown>; users: unknown }>();
  if (ids.length) {
    const { data: cached } = await db
      .from("leagues_cache")
      .select("league_id,settings,users")
      .in("league_id", ids);
    for (const c of cached ?? []) cacheById.set(c.league_id, c);
  }

  const leagues: RecentLeague[] = (rows ?? []).map((r) => {
    const cache = cacheById.get(r.league_id);
    const s = (cache?.settings ?? null) as {
      status?: string;
      total_rosters?: number;
      scoring_settings?: { rec?: number };
      roster_positions?: string[];
    } | null;
    const users = (cache?.users ?? null) as { user_id: string; display_name: string; metadata?: { team_name?: string } }[] | null;
    const teamUser = r.team_id ? users?.find((u) => u.user_id === r.team_id) : null;
    return {
      leagueId: r.league_id,
      name: r.league_name,
      season: r.season,
      teamId: r.team_id,
      teamName: teamUser ? (teamUser.metadata?.team_name ?? teamUser.display_name) : null,
      status: s?.status ?? null,
      scoring: s ? scoringLabel(s.scoring_settings?.rec) : null,
      teams: s?.total_rosters ?? null,
      superflex: s?.roster_positions?.includes("SUPER_FLEX") ?? false,
      lastSeen: r.last_seen,
    };
  });

  return withSidCookie(NextResponse.json({ leagues }), caller.sid);
}

/** Forget a league (the × on a recent row). */
export async function DELETE(req: Request) {
  const caller = await getCaller(req);
  const key = callerKey(caller);
  const leagueId = new URL(req.url).searchParams.get("league");
  if (!leagueId) return NextResponse.json({ error: "league is required." }, { status: 400 });
  await supabaseAdmin().from("user_leagues").delete().eq(key.column, key.value).eq("league_id", leagueId);
  return withSidCookie(NextResponse.json({ ok: true }), caller.sid);
}
