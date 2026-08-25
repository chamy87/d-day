-- Anonymous per-browser sessions (no-login product): cookie sid → prefs jsonb
-- (per-league team choice, etc.). Server-only access via secret key.
create table public.sessions (
  sid        uuid primary key,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sessions enable row level security;

-- Cached AI advisor output per league/roster (sell-high/buy-low analysis, …).
create table public.ai_advice (
  league_id  text not null,
  roster_id  smallint not null,
  kind       text not null,
  advice     jsonb not null,
  model      text,
  updated_at timestamptz not null default now(),
  primary key (league_id, roster_id, kind)
);
alter table public.ai_advice enable row level security;

-- Market context from FantasyCalc beyond raw value: momentum, ranks, age.
alter table public.values_fc
  add column trend30      integer,
  add column overall_rank smallint,
  add column pos_rank     smallint,
  add column age          numeric(4,1);
