import type { SupabaseClient } from "@supabase/supabase-js";
import { sleeper, ffcFormat, ffcTeams } from "./sleeper";
import { computeVBD, scoreProjection, type Projected, type Ranked } from "./vbd";
import {
  ensurePlayers,
  ensureProjections,
  ensureAdp,
  ensureTiers,
  bcScoring,
  normalizeName,
  fetchAll,
} from "./ingest";

const BOARD_TTL_MS = 6 * 60 * 60 * 1000;

export type BoardConfig = {
  scoringSettings: Record<string, number>;
  rosterPositions: string[];
  teams: number;
};

export type BuiltBoard = { board: Ranked[]; degraded: string[]; generatedAt: string };

/**
 * League-shape-keyed VBD board: ensure sources fresh (lazy self-heal), score
 * projections under the exact scoring settings, rank by VBD, overlay Boris
 * Chen tiers, cache in draft_board. Shared by league and mock-draft routes.
 */
export async function buildBoard(db: SupabaseClient, cfg: BoardConfig, refresh = false): Promise<BuiltBoard> {
  const superflex = cfg.rosterPositions.includes("SUPER_FLEX");
  const format = ffcFormat(cfg.scoringSettings, superflex);
  const teams = ffcTeams(cfg.teams);
  const { season } = await sleeper.state();
  const scoringKey = Object.entries(cfg.scoringSettings ?? {})
    .sort()
    .map(([k, v]) => `${k}${v}`)
    .join("");
  const formatKey = `${season}:${teams}:${format}:${superflex ? "sf" : "std"}:${cfg.rosterPositions.join(",")}:${scoringKey}`.slice(0, 250);

  if (!refresh) {
    const { data: cached } = await db
      .from("draft_board")
      .select("board,updated_at")
      .eq("format_key", formatKey)
      .maybeSingle();
    if (cached && Date.now() - new Date(cached.updated_at).getTime() < BOARD_TTL_MS) {
      const payload = cached.board as { board: Ranked[]; degraded: string[] };
      return { board: payload.board, degraded: payload.degraded, generatedAt: cached.updated_at };
    }
  }

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
  const tierBucket = bcScoring(cfg.scoringSettings?.rec);
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
    throw new Error("Projections unavailable and no cached board exists yet — try again shortly.");
  }

  const playerById = new Map(players.map((p) => [p.sleeper_id, p]));
  const adpById = new Map(adpRows.map((a) => [a.sleeper_id, a.adp]));

  const projected: Projected[] = [];
  for (const row of projections) {
    const p = playerById.get(row.sleeper_id);
    if (!p) continue;
    const points = scoreProjection(row.stats, cfg.scoringSettings ?? {});
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

  const board = computeVBD(projected, { rosterPositions: cfg.rosterPositions, teams: cfg.teams }).slice(0, 300);

  // Boris Chen tiers override the computed VBD-gap tiers where names match;
  // then forced non-decreasing down the board so groups stay sane.
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

  const generatedAt = new Date().toISOString();
  await db
    .from("draft_board")
    .upsert({ format_key: formatKey, board: { board, degraded }, updated_at: generatedAt })
    .then(() => undefined, () => undefined);

  return { board, degraded, generatedAt };
}
