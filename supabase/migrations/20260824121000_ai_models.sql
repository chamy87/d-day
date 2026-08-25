-- Registry of available AI models per provider, refreshed by /api/cron/models.
-- Lets the app pick the current default model without redeploying.
create table public.ai_models (
  provider            text not null,          -- 'anthropic' | 'openai'
  model_id            text not null,
  display_name        text,
  is_default          boolean not null default false,
  capabilities        jsonb,
  created_at_provider timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (provider, model_id)
);

alter table public.ai_models enable row level security;
