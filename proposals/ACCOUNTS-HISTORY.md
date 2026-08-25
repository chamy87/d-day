# D-Day — Accounts & history brief (for Claude Code)

Grounded in commit b5fe666 (`src/lib/session-client.ts`, `supabase/migrations/20260825060000_sessions_advice_values.sql`, `src/components/landing.tsx`, `src/lib/supabase.ts`). Visual reference: `proposals/account-v1/index.html` — interactive mock of the landing with recent leagues, sign-in sheet, and history drawer.

## Principle: auth is an upgrade, never a gate
"No login" stays the headline. Everything works anonymously exactly as today (cookie sid → `sessions.data`). Supabase Auth (magic link + Google OAuth — no passwords) is offered only where it earns its keep: syncing across devices and preserving history. Never block a screen behind sign-in.

## 1. Schema
Keep `sessions` as-is for anonymous users. Add:

```sql
-- Signed-in user profile; keyed by auth.users.
create table public.profiles (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}',   -- same shape as sessions.data (teams, queues)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Leagues a user has opened (anonymous OR signed in — one nullable key each).
create table public.user_leagues (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users on delete cascade,
  sid        uuid,                          -- anonymous fallback
  league_id  text not null,
  league_name text,
  season     text,
  team_id    text,                          -- their claimed roster
  last_seen  timestamptz not null default now(),
  unique (user_id, league_id),
  unique (sid, league_id)
);

-- Saved trade evaluations (advisor) + other durable events.
create table public.user_history (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users on delete cascade,
  sid        uuid,
  league_id  text not null,
  kind       text not null,                 -- 'trade_eval' | 'draft_recap' | 'waiver_claim'
  payload    jsonb not null,                -- e.g. {sends, receives, verdict, valueDelta}
  created_at timestamptz not null default now()
);
create index user_history_lookup on public.user_history (coalesce(user_id::text, sid::text), league_id, created_at desc);
```

RLS: policies `user_id = auth.uid()` for select/insert/delete on all three; anonymous rows (sid-keyed) stay server-only via the secret key, same as `sessions` today.

**Merge on sign-in**: server route `POST /api/account/merge` — copies the cookie sid's `sessions.data` into `profiles.data` (profile wins on conflict) and re-keys the sid's `user_leagues`/`user_history` rows to `user_id`. Call it once right after the first auth callback.

## 2. Landing: recent leagues
Problem: returning users re-paste their league ID every visit.
Fix: under the input, a "Recent leagues" list from `user_leagues` (works anonymously via sid — sign-in just makes it survive browser changes). Each row: league name, season, scoring tags, status tag, claimed-team chip, one tap → routes by status like the detected-league card does. "×" to forget. Auto-record a league on every successful lookup (upsert `last_seen`).

## 3. Header: account entry point
A small ghost avatar button at top-right of every screen (landing, draft, dashboard):
- Signed out: opens a sign-in sheet — "Sync your leagues across devices" + magic-link email input + "Continue with Google". Copy stresses optionality: "Everything works without an account."
- Signed in: menu — email, My leagues, History, Sign out.
Reuse `TeamChip` visual language (pill, initials circle).

## 4. Trade history (advisor)
When the user runs a trade evaluation, persist it to `user_history` (kind `trade_eval`, fire-and-forget like `saveTeamPref`). Add a "Past evaluations" section below the builder: date, sends → receives (PositionBadge + name), value delta (StatDelta), AI verdict tag. Tap to re-open the full evaluation. This is the durable-value hook that makes sign-in worth it.

## 5. Draft recap
After a draft completes, snapshot the user's picks + VBD-vs-ADP deltas into `user_history` (kind `draft_recap`, once, server-side). Dashboard gets a "Draft recap" card: total value gained vs ADP, best pick, biggest reach. Cheap to compute — the data is already in `/draft/{id}/picks` + the cached board.

## 6. Session-client changes
`session-client.ts` gains one seam: if a Supabase session exists, read/write `profiles.data` through `/api/account/prefs` instead of `/api/session`; localStorage stays the instant layer for both. `supabase.ts`: browser client flips `persistSession: true` only after first sign-in (store a `dday:authed` flag to avoid the auth roundtrip for anonymous users).

Priority: 2 (recent leagues, works pre-auth), 1+3 (auth + merge), 4 (trade history), 5, 6.
