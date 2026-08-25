import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let browserClient: SupabaseClient | undefined;

/** Publishable-key client for client components and public reads (RLS enforced). */
export function supabaseBrowser(): SupabaseClient {
  browserClient ??= createClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    auth: { persistSession: false }, // no-login product
  });
  return browserClient;
}

/** Secret-key client for API routes and cron jobs. Server-only. */
export function supabaseAdmin(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false },
  });
}
