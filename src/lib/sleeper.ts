/** Server-side Sleeper API helpers. All calls are keyless and public. */

const BASE = process.env.SLEEPER_API_BASE ?? "https://api.sleeper.app/v1";

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  status: string; // pre_draft | drafting | in_season | complete
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  draft_id: string | null;
};

export type SleeperUser = {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
};

export type SleeperDraft = {
  draft_id: string;
  league_id: string;
  status: string; // pre_draft | drafting | paused | complete
  type: string; // snake | linear | auction
  start_time: number | null;
  last_picked: number | null;
  draft_order: Record<string, number> | null; // user_id -> slot
  settings: { teams: number; pick_timer?: number; rounds?: number };
};

export type SleeperPick = {
  pick_no: number;
  round: number;
  draft_slot: number;
  player_id: string;
  picked_by: string; // user_id ('' for autopick)
  metadata?: { first_name?: string; last_name?: string; position?: string; team?: string };
};

export type SleeperPlayer = {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team: string | null;
  position: string | null;
  fantasy_positions: string[] | null;
  status: string | null;
  injury_status: string | null;
  active: boolean;
};

async function get<T>(path: string, base = BASE): Promise<T> {
  const res = await fetch(`${base}${path}`, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Sleeper ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const sleeper = {
  league: (id: string) => get<SleeperLeague | null>(`/league/${id}`),
  leagueUsers: (id: string) => get<SleeperUser[]>(`/league/${id}/users`),
  draft: (id: string) => get<SleeperDraft | null>(`/draft/${id}`),
  draftPicks: (id: string) => get<SleeperPick[]>(`/draft/${id}/picks`),
  /** ~5 MB payload — call at most daily (used by ingest, never per-request). */
  playersMap: () => get<Record<string, SleeperPlayer>>(`/players/nfl`),
  state: () => get<{ season: string; week: number }>(`/state/nfl`),
  /** Unofficial projections endpoint — fragile by design; callers must catch. */
  seasonProjections: (season: string) =>
    get<{ player_id: string; stats: Record<string, number> | null }[]>(
      `/projections/nfl/${season}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF&order_by=adp_ppr`,
      "https://api.sleeper.com",
    ),
};

export function scoringLabel(rec: number | undefined): string {
  if (rec === 1) return "PPR";
  if (rec === 0.5) return "Half PPR";
  if (!rec) return "Standard";
  return `${rec} PPR`;
}

/** FFC ADP format for a league's scoring + superflex shape. */
export function ffcFormat(scoring: Record<string, number>, superflex: boolean): string {
  if (superflex) return "2qb";
  const rec = scoring?.rec ?? 0;
  if (rec >= 1) return "ppr";
  if (rec >= 0.5) return "half-ppr";
  return "standard";
}

/** FFC supports 8/10/12/14-team boards; snap to nearest. */
export function ffcTeams(teams: number): number {
  const options = [8, 10, 12, 14];
  return options.reduce((a, b) => (Math.abs(b - teams) < Math.abs(a - teams) ? b : a));
}

export function injuryTag(injuryStatus: string | null | undefined): string | null {
  switch (injuryStatus) {
    case "Questionable":
      return "Q";
    case "Doubtful":
      return "D";
    case "Out":
      return "OUT";
    case "IR":
      return "IR";
    case "PUP":
      return "PUP";
    case "Sus":
      return "SUS";
    default:
      return null;
  }
}
