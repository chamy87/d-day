/**
 * NFL week schedule from ESPN's public scoreboard (keyless): opponent,
 * kickoff, and game state per team. Used by start/sit for lock times and
 * "inactives post 90 min before kickoff" guidance on questionable starters.
 */

export type TeamGame = {
  opp: string;
  home: boolean;
  kickoff: string; // ISO
  /** pre | in | post */
  state: string;
};

const ESPN_TEAM: Record<string, string> = { WSH: "WAS" };

export async function weekSchedule(season: string, week: number): Promise<Map<string, TeamGame>> {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) throw new Error(`ESPN scoreboard → ${res.status}`);
  const body = (await res.json()) as {
    events?: {
      date: string;
      status?: { type?: { state?: string } };
      competitions?: { competitors?: { homeAway: string; team?: { abbreviation?: string } }[] }[];
    }[];
  };
  const out = new Map<string, TeamGame>();
  for (const ev of body.events ?? []) {
    const comps = ev.competitions?.[0]?.competitors ?? [];
    const abbr = (c: (typeof comps)[number]) => {
      const a = c.team?.abbreviation ?? "";
      return ESPN_TEAM[a] ?? a;
    };
    for (const c of comps) {
      const other = comps.find((x) => x !== c);
      if (!other) continue;
      out.set(abbr(c), {
        opp: abbr(other),
        home: c.homeAway === "home",
        kickoff: ev.date,
        state: ev.status?.type?.state ?? "pre",
      });
    }
  }
  return out;
}
