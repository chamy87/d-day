-- In-season management: start/sit inputs (opponent, live injuries) and
-- season-to-date actuals for objective roster-need / trade math.

alter table public.projections add column if not exists opponent text;

alter table public.injuries
  add column if not exists comment    text,
  add column if not exists comment_at timestamptz;

-- Sleeper season-to-date stat lines (raw keys match league scoring_settings,
-- so points are scored per league rather than stored per format).
create table if not exists public.player_stats_ytd (
  season     smallint not null,
  sleeper_id text not null,
  gp         smallint not null default 0,
  stats      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (season, sleeper_id)
);
alter table public.player_stats_ytd enable row level security;
