import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sleeper, scoringLabel, ffcFormat, ffcTeams } from "@/lib/sleeper";
import { computeVBD, scoreProjection, type Projected, type Ranked } from "@/lib/vbd";
import {
  ensurePlayers,
  ensureProjections,
  ensureAdp,
  ensureTiers,
  bcScoring,
  normalizeName,
  fetchAll,
} from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // cold path ingests the Sleeper players map

const BOARD_TTL_MS = 6 * 60 * 60 * 1000;

export type BoardResponse = {
  league: {
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

  const db = supabaseAdmin();
  const superflex = league.roster_positions.includes("SUPER_FLEX");
  const format = ffcFormat(league.scoring_settings, superflex);
  const teams = ffcTeams(league.total_rosters);
  const { season } = await sleeper.state();
  // Board cache key: everything VBD depends on except the exact league id,
  // hashed over scoring so leagues with custom scoring don't collide.
  const scoringKey = Object.entries(league.scoring_settings ?? {})
    .sort()
    .map(([k, v]) => `${k}${v}`)
    .join("");
  const formatKey = `${season}:${teams}:${format}:${superflex ? "sf" : "std"}:${league.roster_positions.join(",")}:${scoringKey}`.slice(0, 250);

  const users = (await sleeper.leagueUsers(leagueId).catch(() => [])).map((u) => ({
    userId: u.user_id,
    name: u.display_name,
    teamName: u.metadata?.team_name ?? null,
  }));

  // Serve cached board when fresh.
  if (!refresh) {
    const { data: cached } = await db
      .from("draft_board")
      .select("board,updated_at")
      .eq("format_key", formatKey)
      .maybeSingle();
    if (cached && Date.now() - new Date(cached.updated_at).getTime() < BOARD_TTL_MS) {
      const payload = cached.board as { board: Ranked[]; degraded: string[] };
      return NextResponse.json({
        league: summarize(league),
        users,
        board: payload.board,
        degraded: payload.degraded,
        generatedAt: cached.updated_at,
      } satisfies BoardResponse);
    }
  }

  // Ensure sources are fresh (lazy self-heal; cron warms these daily).
  const degraded: string[] = [];
  try {
    await ensurePlayers(db);
  } catch {
    degraded.push("players");
  }
  try {
    await ensureProjections(db, season);
  } catch {
    degraded.push("projections");
  }
  try {
    await ensureAdp(db, format, teams, season);
  } catch {
    degraded.push("adp");
  }
  const tierBucket = bcScoring(league.scoring_settings?.rec);
  try {
    await ensureTiers(db, tierBucket);
  } catch {
    degraded.push("tiers");
  }

  const [players, projections, adpRows] = await Promise.all([
    fetchAll<{ sleeper_id: string; name: string; team: string | null; pos: string; bye: number | null; status: string | null }>(
      (from, to) => db.from("players").select("sleeper_id,name,team,pos,bye,status").range(from, to),
    ),
    fetchAll<{ sleeper_id: string; stats: Record<string, number> }>((from, to) =>
      db
        .from("projections")
        .select("sleeper_id,stats")
        .eq("season", Number(season))
        .eq("week", 0)
        .range(from, to),
    ),
    fetchAll<{ sleeper_id: string; adp: number | null }>((from, to) =>
      db.from("adp").select("sleeper_id,adp").eq("format", format).eq("teams", teams).range(from, to),
    ),
  ]);

  if (!projections.length) {
    return NextResponse.json(
      { error: "Projections unavailable and no cached board exists yet — try again shortly." },
      { status: 503 },
    );
  }

  const playerById = new Map(players.map((p) => [p.sleeper_id, p]));
  const adpById = new Map(adpRows.map((a) => [a.sleeper_id, a.adp]));

  const projected: Projected[] = [];
  for (const row of projections) {
    const p = playerById.get(row.sleeper_id);
    if (!p) continue;
    const points = scoreProjection(row.stats, league.scoring_settings ?? {});
    if (points <= 0) continue;
    projected.push({
      sleeperId: p.sleeper_id,
      name: p.name,
      team: p.team,
      pos: p.pos,
      points,
      bye: p.bye,
      injury: p.status,
      adp: adpById.get(p.sleeper_id) ?? null,
    });
  }

  const board = computeVBD(projected, {
    rosterPositions: league.roster_positions,
    teams: league.total_rosters,
  }).slice(0, 300);

  // Boris Chen tiers override the computed VBD-gap tiers where names match;
  // tiers are then forced non-decreasing down the board so groups stay sane.
  try {
    const tierRows = await fetchAll<{ pos: string; tier: number; player_name: string }>((from, to) =>
      db.from("tiers").select("pos,tier,player_name").eq("scoring", tierBucket).range(from, to),
    );
    if (tierRows.length) {
      const tierByKey = new Map(tierRows.map((t) => [`${normalizeName(t.player_name)}:${t.pos}`, t.tier]));
      for (const p of board) {
        const bc = tierByKey.get(`${normalizeName(p.name)}:${p.pos}`);
        if (bc != null) p.tier = bc;
      }
      for (let i = 1; i < board.length; i++) {
        if (board[i].tier < board[i - 1].tier) board[i].tier = board[i - 1].tier;
      }
    }
  } catch {
    degraded.push("tiers");
  }

  await db
    .from("draft_board")
    .upsert({ format_key: formatKey, board: { board, degraded }, updated_at: new Date().toISOString() })
    .then(() => undefined, () => undefined); // cache write is best-effort

  return NextResponse.json({
    league: summarize(league),
    users,
    board,
    degraded,
    generatedAt: new Date().toISOString(),
  } satisfies BoardResponse);
}

function summarize(league: NonNullable<Awaited<ReturnType<typeof sleeper.league>>>) {
  return {
    leagueId: league.league_id,
    name: league.name,
    season: league.season,
    status: league.status,
    teams: league.total_rosters,
    scoring: scoringLabel(league.scoring_settings?.rec),
    superflex: league.roster_positions.includes("SUPER_FLEX"),
    rosterPositions: league.roster_positions,
    draftId: league.draft_id,
  };
}
