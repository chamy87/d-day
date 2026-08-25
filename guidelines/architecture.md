# D-Day — Product Architecture Reference

Reference spec for building the real app (Next.js App Router + TypeScript, Vercel, Supabase, Tailwind, React Query, Recharts).

## Information architecture
- `/` Landing — league-ID input (or username → league picker) → league summary card → routes by `league.status`
- `/league/[id]/draft` Live Draft Room — best-available board (VBD + tiers + ADP), on-the-clock header, my-roster rail, suggested picks, recent-picks ticker
- `/league/[id]` In-Season Dashboard — start/sit, matchup, waivers, news feed

## Screen → component breakdown
- Landing: `Input(mono,lg)` + `Button(primary,lg)`; league summary `Card` with `Tag`s (scoring, teams, roster slots) → CTA
- Draft Room: header (wordmark, on-the-clock `Card(glow)`, mono timer, "picks until you"); board `Card(pad=false)` of `TierBreak`+`PlayerRow` with `Tabs` position filter + `Switch(hide drafted)`; rail: MY ROSTER `Card` (slots from `roster_positions`, needs highlighted), SUGGESTED `Card` (top 1–3 + one-line rationale), scarcity `Toast(warn)`; fixed bottom ticker of recent picks
- Dashboard: `Tabs` (Start/Sit · Matchup · Waivers · News); start/sit = `PlayerRow`s ranked by adjusted projection with risk `Tag`s; matchup = two roster columns + mono projected totals; waivers = trending ∩ unrostered ranked by ROS value with FAAB `Tag`s; news = filtered RSS list

## Supabase schema (tables)
`players` (sleeper_id pk, name, team, pos, bye, status, meta jsonb) — daily from /players/nfl
`projections` (season, week, sleeper_id, stats jsonb) — fragile source, nullable
`adp` (format, teams, sleeper_id→ffc join, adp, stdev, updated_at)
`values_fc` (sleeper_id, value, num_qbs, ppr, updated_at)
`tiers` (pos, scoring, tier, rank, player_name, updated_at) — Boris Chen
`injuries` (sleeper_id, designation, detail, updated_at) — nflverse
`news_cache` (id, source, title, url, player_ids[], published_at)
`draft_board` (format key, precomputed ranked board jsonb, updated_at)
`leagues_cache` (league_id pk, settings jsonb, rosters jsonb, users jsonb, fetched_at)

## Routes / API
- `app/api/league/[id]` — validate + summarize league (server-side Sleeper calls, cached)
- `app/api/board/[leagueId]` — league-tuned VBD board (compute on entry from cached inputs)
- `app/api/draft/[draftId]/picks` — proxy + cache; client polls via `useDraftPicks(draftId)` (React Query, `refetchInterval: 3000`, only while `status==='drafting'`)
- `app/api/cron/daily` — players map, ADP, FantasyCalc, tiers, projections, injuries
- `app/api/cron/frequent` — /state/nfl few times daily; trending + RSS every 15–60 min in-season
- All third-party calls server-side; respect Sleeper 1000/min.

## VBD (documented TS signature)
```ts
/** Projected points under this league's exact scoring_settings. */
scoreProjection(stats: StatLine, scoring: Record<string, number>): number
/**
 * Replacement baseline per position from roster_positions × total_rosters.
 * Starters(pos) = direct slots + FLEX share (RB/WR/TE) + SUPER_FLEX share (QB boost).
 * Baseline(pos) = projected points of player ranked (starters × teams) at pos.
 * VBD(player) = scoreProjection(player) − baseline(player.pos).
 */
computeVBD(players: Projected[], league: SleeperLeague): Ranked[]
```
Present VBD **alongside** ADP and tiers — never as the only signal. Wrap fragile sources in try/catch; on failure show the "Projections degraded" Toast and fall back to cached VBD.
