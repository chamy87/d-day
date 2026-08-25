-- D-Day initial schema (see guidelines/architecture.md)
--
-- All tables are server-written caches of external sources (Sleeper, nflverse,
-- FFC, FantasyCalc, Boris Chen) and server-read via the secret key. No FKs
-- between cache tables: ingest crons upsert independently and must not fail on
-- arrival order. RLS is enabled with no policies (deny-by-default for the
-- publishable key); the secret key bypasses RLS.

-- Players: canonical map from Sleeper /players/nfl, refreshed daily.
create table public.players (
  sleeper_id text primary key,
  name       text not null,
  team       text,
  pos        text,
  bye        smallint,
  status     text,
  meta       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create index players_pos_idx on public.players (pos);

-- Weekly/seasonal projections. week 0 = full-season. Fragile source: nullable stats.
create table public.projections (
  season     smallint not null,
  week       smallint not null,
  sleeper_id text not null,
  stats      jsonb,
  updated_at timestamptz not null default now(),
  primary key (season, week, sleeper_id)
);
create index projections_sleeper_id_idx on public.projections (sleeper_id);

-- ADP from FantasyFootballCalculator, keyed by scoring format and league size.
create table public.adp (
  format     text not null,
  teams      smallint not null,
  sleeper_id text not null,
  adp        numeric(6,2),
  stdev      numeric(6,2),
  updated_at timestamptz not null default now(),
  primary key (format, teams, sleeper_id)
);

-- FantasyCalc trade values, keyed by league shape.
create table public.values_fc (
  sleeper_id text not null,
  num_qbs    smallint not null,
  ppr        numeric(3,1) not null,
  value      integer,
  updated_at timestamptz not null default now(),
  primary key (sleeper_id, num_qbs, ppr)
);

-- Boris Chen tiers (matched by player name at ingest).
create table public.tiers (
  pos         text not null,
  scoring     text not null,
  tier        smallint not null,
  rank        smallint not null,
  player_name text not null,
  updated_at  timestamptz not null default now(),
  primary key (pos, scoring, rank)
);

-- Injury designations from nflverse.
create table public.injuries (
  sleeper_id  text primary key,
  designation text,
  detail      text,
  updated_at  timestamptz not null default now()
);

-- Filtered news feed cache. id = "<source>:<guid>".
create table public.news_cache (
  id           text primary key,
  source       text not null,
  title        text not null,
  url          text,
  player_ids   text[] not null default '{}',
  published_at timestamptz
);
create index news_cache_published_at_idx on public.news_cache (published_at desc);
create index news_cache_player_ids_idx on public.news_cache using gin (player_ids);

-- Precomputed ranked boards per scoring-format key (e.g. "half-ppr:12:sf").
create table public.draft_board (
  format_key text primary key,
  board      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Sleeper league settings/rosters/users cache, keyed by league id.
create table public.leagues_cache (
  league_id  text primary key,
  settings   jsonb,
  rosters    jsonb,
  users      jsonb,
  fetched_at timestamptz not null default now()
);

-- Deny-by-default: RLS on, no policies. All app access goes through server
-- routes using the secret key. Add anon read policies later only if the client
-- ever reads tables directly.
alter table public.players       enable row level security;
alter table public.projections   enable row level security;
alter table public.adp           enable row level security;
alter table public.values_fc     enable row level security;
alter table public.tiers         enable row level security;
alter table public.injuries      enable row level security;
alter table public.news_cache    enable row level security;
alter table public.draft_board   enable row level security;
alter table public.leagues_cache enable row level security;
