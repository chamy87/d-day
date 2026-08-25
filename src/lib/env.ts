/**
 * Server/client env access with fail-fast errors.
 *
 * Local dev uses the names in .env.local; on Vercel the Supabase integration
 * injects its own names, which we fall back to. NEXT_PUBLIC_* accesses must
 * stay as literal `process.env.X` expressions so Next.js can inline them
 * into client bundles.
 */
function pick(primary: string | undefined, fallback: string | undefined, label: string): string {
  const v = primary || fallback;
  if (!v) throw new Error(`Missing env var ${label} — add it to .env.local (see .env.example)`);
  return v;
}

export const env = {
  supabaseUrl: () =>
    pick(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
  /** Publishable key (sb_publishable_…) — safe for the browser, RLS enforced. */
  supabasePublishableKey: () =>
    pick(
      process.env.NEXT_PUBLIC_SUPABASE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "NEXT_PUBLIC_SUPABASE_KEY",
    ),
  /** Secret key (sb_secret_…) — server-only, bypasses RLS. Never import from client components. */
  supabaseSecretKey: () =>
    pick(process.env.NEXT_SECRET_SUPABASE_KEY, process.env.SUPABASE_SECRET_KEY, "NEXT_SECRET_SUPABASE_KEY"),
  cronSecret: () => pick(process.env.CRON_SECRET, undefined, "CRON_SECRET"),
};
