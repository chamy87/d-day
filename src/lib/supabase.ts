import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let browserClient: SupabaseClient | undefined;

/** Publishable-key client for client components and public reads (RLS enforced). */
export function supabaseBrowser(): SupabaseClient {
  // Auth is optional: session persistence turns on only after first sign-in
  // (dday:authed flag) so anonymous users skip the auth roundtrip entirely.
  const authed = typeof window !== "undefined" && localStorage.getItem("dday:authed") === "1";
  browserClient ??= createClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    auth: { persistSession: authed },
  });
  return browserClient;
}

/** Secret-key client for API routes and cron jobs. Server-only. */
export function supabaseAdmin(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false },
  });
}
