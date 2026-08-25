/** Server-side env access with fail-fast errors for missing keys. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} — add it to .env.local (see .env.example)`);
  return v;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  /** Publishable key (sb_publishable_…) — safe for the browser, RLS enforced. */
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_KEY"),
  /** Secret key (sb_secret_…) — server-only, bypasses RLS. Never import from client components. */
  supabaseSecretKey: () => required("NEXT_SECRET_SUPABASE_KEY"),
  cronSecret: () => required("CRON_SECRET"),
};
