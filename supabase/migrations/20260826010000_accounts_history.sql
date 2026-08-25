-- Accounts & history (proposals/ACCOUNTS-HISTORY.md). Auth is an upgrade,
-- never a gate: anonymous users keep the sessions table; these tables carry
-- signed-in profiles plus league/trade history for both identities (one
-- nullable key each — user_id for auth users, sid for anonymous cookies).
-- Anonymous (sid) rows are server-only via the secret key; RLS below covers
-- the authenticated path.

create table public.profiles (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_own on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.user_leagues (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users on delete cascade,
  sid         uuid,
  league_id   text not null,
  league_name text,
  season      text,
  team_id     text,
  last_seen   timestamptz not null default now(),
  unique (user_id, league_id),
  unique (sid, league_id)
);
alter table public.user_leagues enable row level security;
create policy user_leagues_own on public.user_leagues
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create index user_leagues_sid_idx on public.user_leagues (sid, last_seen desc);

create table public.user_history (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users on delete cascade,
  sid        uuid,
  league_id  text not null,
  kind       text not null, -- 'trade_eval' | 'draft_recap' | 'waiver_claim'
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.user_history enable row level security;
create policy user_history_own on public.user_history
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create index user_history_lookup
  on public.user_history ((coalesce(user_id::text, sid::text)), league_id, created_at desc);
