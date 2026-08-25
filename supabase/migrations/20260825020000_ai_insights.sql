-- Cached AI-generated weekly flags per league/roster (start/sit reasoning).
create table public.ai_insights (
  league_id  text not null,
  roster_id  smallint not null,
  week       smallint not null,
  insights   jsonb not null,
  model      text,
  updated_at timestamptz not null default now(),
  primary key (league_id, roster_id, week)
);

alter table public.ai_insights enable row level security;
