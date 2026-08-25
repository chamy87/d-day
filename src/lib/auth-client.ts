"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Optional Supabase Auth (magic link + Google, no passwords). Auth is an
 * upgrade, never a gate: nothing initializes for anonymous users. The
 * `dday:authed` flag skips the auth roundtrip until first sign-in; the URL
 * check catches the return leg of a magic link / OAuth redirect.
 */
const FLAG = "dday:authed";

let client: SupabaseClient | null = null;

export function isAuthed(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(FLAG) === "1";
}

export function setAuthedFlag(on: boolean): void {
  if (on) localStorage.setItem(FLAG, "1");
  else localStorage.removeItem(FLAG);
}

export function shouldInitAuth(): boolean {
  if (typeof window === "undefined") return false;
  return isAuthed() || window.location.hash.includes("access_token") || window.location.search.includes("code=");
}

export function authClient(): SupabaseClient {
  client ??= createClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export async function currentUser(): Promise<User | null> {
  if (!shouldInitAuth()) return null;
  const { data } = await authClient().auth.getSession();
  return data.session?.user ?? null;
}

export async function accessToken(): Promise<string | null> {
  if (!shouldInitAuth()) return null;
  const { data } = await authClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/** fetch that carries the Supabase access token when signed in. */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken();
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const { error } = await authClient().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return { error: error?.message ?? null };
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const { error } = await authClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await authClient().auth.signOut();
  setAuthedFlag(false);
}

/** Fold the anonymous cookie session into the account, once per user. */
export async function mergeOnce(userId: string): Promise<void> {
  const marker = `dday:merged:${userId}`;
  if (localStorage.getItem(marker)) return;
  try {
    const res = await authFetch("/api/account/merge", { method: "POST" });
    if (res.ok) localStorage.setItem(marker, "1");
  } catch {
    // retried on next sign-in event
  }
}
