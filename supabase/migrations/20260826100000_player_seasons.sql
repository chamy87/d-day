-- Historical per-season player stats from nflverse/nflfastR
-- (player_stats_season_{year}.csv). Matched to Sleeper ids by name+position
-- at ingest. Feeds the AI advisor's historical/trajectory analysis.
create table public.player_seasons (
  season     smallint not null,
  sleeper_id text not null,
  name       text not null,
  pos        text not null,
  team       text,
  games      smallint,
  fp_ppr     numeric(6,1),
  ppg        numeric(4,1), -- PPR points per game
  stats      jsonb not null, -- carries, rush_yd, targets, rec, rec_yd, tds, target_share
  updated_at timestamptz not null default now(),
  primary key (season, sleeper_id)
);
alter table public.player_seasons enable row level security;
create index player_seasons_player_idx on public.player_seasons (sleeper_id, season desc);
