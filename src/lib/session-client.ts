"use client";

import { isAuthed, authFetch } from "./auth-client";

/**
 * Client side of prefs. localStorage answers instantly; the server copy wins
 * when present. Anonymous users read/write the cookie session
 * (/api/session); signed-in users read/write their profile
 * (/api/account/prefs) so prefs follow them across devices.
 */
function prefsGet(): Promise<Response> {
  return isAuthed() ? authFetch("/api/account/prefs") : fetch("/api/session");
}

function prefsPut(merge: Record<string, unknown>): void {
  const body = JSON.stringify({ merge });
  const init: RequestInit = { method: "PUT", headers: { "content-type": "application/json" }, body };
  (isAuthed() ? authFetch("/api/account/prefs", init) : fetch("/api/session", init)).catch(() => {});
}

export async function loadTeamPref(scope: string): Promise<string | null> {
  const local = localStorage.getItem(`dday:team:${scope}`);
  try {
    const res = await prefsGet();
    const d = (await res.json()) as { data?: { teams?: Record<string, string> } };
    return d.data?.teams?.[scope] ?? local;
  } catch {
    return local;
  }
}

export function saveTeamPref(scope: string, value: string): void {
  localStorage.setItem(`dday:team:${scope}`, value);
  prefsPut({ teams: { [scope]: value } });
}

/** Draft queue (starred player ids), persisted like the team pref. */
export async function loadQueuePref(scope: string): Promise<string[]> {
  const local = localStorage.getItem(`dday:queue:${scope}`);
  const fallback = local ? (JSON.parse(local) as string[]) : [];
  try {
    const res = await prefsGet();
    const d = (await res.json()) as { data?: { queues?: Record<string, string[]> } };
    return d.data?.queues?.[scope] ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveQueuePref(scope: string, ids: string[]): void {
  localStorage.setItem(`dday:queue:${scope}`, JSON.stringify(ids));
  prefsPut({ queues: { [scope]: ids } });
}
