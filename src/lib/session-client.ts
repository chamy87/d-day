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
