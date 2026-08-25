@AGENTS.md

# D-Day — project rules

## Account isolation (IMPORTANT)
This project is **standalone** and must stay separate from every other project the user owns.

- **NEVER** create, deploy to, or modify resources in the Vercel team **"Frametry"** (`team_w8tFiT8XrL8Y7oKefqkPw8fM`) or the Supabase org **"Frametry"** (`vercel_icfg_IBd7ne5WWKr9zfdQWnB3n8SP`), even though MCP servers for them may be connected to the session. Those belong to a different project.
- Do not run `vercel deploy`, `create_git_project`, `deploy_to_vercel`, Supabase `create_project`/`apply_migration`, or similar provisioning against any account unless the credentials were explicitly provided **for d-day** in `.env.local` (or the user names the correct team/org in chat).
- All credentials live in **`.env.local`** (gitignored) and are supplied by the user. `.env.example` is the tracked template. Never hardcode keys.
- Supabase access for this project: use the connection details from `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` publishable, `NEXT_SECRET_SUPABASE_KEY` secret, `SUPABASE_DB_API_URL`), not the connected Supabase MCP, until the user connects an MCP scoped to the new d-day project. The project uses Supabase's new publishable/secret API keys — do not reintroduce legacy anon/service-role JWT keys.
- GitHub and Vercel operations for this repo authenticate with `GITHUB_TOKEN` / `VERCEL_TOKEN` from `.env.local` — not with any other stored credentials (`gh` keyring auth, other Vercel logins). The Vercel account hosts both "d-day" and "Scarlettox" as separate projects; only ever touch **d-day**.

## Stack
Next.js App Router + TypeScript · Tailwind v4 · @supabase/supabase-js · @tanstack/react-query · Recharts. Product spec: `guidelines/architecture.md`. Design system: `readme.md`, `tokens/`, `components/` (reference JSX — excluded from tsconfig/eslint; re-implement in `src/` when building real UI).

## Data sources
Sleeper, nflverse, FantasyFootballCalculator, FantasyCalc, Boris Chen — all public/keyless, called server-side only. Respect Sleeper's 1000 req/min limit.
