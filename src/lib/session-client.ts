"use client";

/**
 * Client side of the anonymous session. localStorage answers instantly;
 * the server session (cookie-keyed, per browser) wins when present so
 * concurrent users on different browsers never collide.
 */
export async function loadTeamPref(scope: string): Promise<string | null> {
  const local = localStorage.getItem(`dday:team:${scope}`);
  try {
    const res = await fetch("/api/session");
    const d = (await res.json()) as { data?: { teams?: Record<string, string> } };
    return d.data?.teams?.[scope] ?? local;
  } catch {
    return local;
  }
}

export function saveTeamPref(scope: string, value: string): void {
  localStorage.setItem(`dday:team:${scope}`, value);
  fetch("/api/session", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ merge: { teams: { [scope]: value } } }),
  }).catch(() => {});
}

/** Draft queue (starred player ids), persisted like the team pref. */
export async function loadQueuePref(scope: string): Promise<string[]> {
  const local = localStorage.getItem(`dday:queue:${scope}`);
  const fallback = local ? (JSON.parse(local) as string[]) : [];
  try {
    const res = await fetch("/api/session");
    const d = (await res.json()) as { data?: { queues?: Record<string, string[]> } };
    return d.data?.queues?.[scope] ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveQueuePref(scope: string, ids: string[]): void {
  localStorage.setItem(`dday:queue:${scope}`, JSON.stringify(ids));
  fetch("/api/session", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ merge: { queues: { [scope]: ids } } }),
  }).catch(() => {});
}
