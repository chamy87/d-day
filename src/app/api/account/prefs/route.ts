import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCaller } from "@/lib/identity";

export const dynamic = "force-dynamic";

/** Signed-in twin of /api/session: prefs live in profiles.data. */
export async function GET(req: Request) {
  const caller = await getCaller(req);
  if (!caller.userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: row } = await supabaseAdmin()
    .from("profiles")
    .select("data")
    .eq("user_id", caller.userId)
    .maybeSingle();
  return NextResponse.json({ data: (row?.data as Record<string, unknown>) ?? {} });
}

export async function PUT(req: Request) {
  const caller = await getCaller(req);
  if (!caller.userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let merge: Record<string, unknown>;
  try {
    merge = ((await req.json()) as { merge?: Record<string, unknown> }).merge ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: row } = await db.from("profiles").select("data").eq("user_id", caller.userId).maybeSingle();
  const current = (row?.data as Record<string, unknown>) ?? {};
  const next: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(merge)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof next[k] === "object" && next[k] !== null) {
      next[k] = { ...(next[k] as Record<string, unknown>), ...(v as Record<string, unknown>) };
    } else {
      next[k] = v;
    }
  }
  await db.from("profiles").upsert({ user_id: caller.userId, data: next, updated_at: new Date().toISOString() });

  // Claimed-team changes ride along into the recent-leagues rows.
  const teams = merge.teams as Record<string, string> | undefined;
  if (teams) {
    for (const [leagueId, teamId] of Object.entries(teams)) {
      await db
        .from("user_leagues")
        .update({ team_id: teamId })
        .eq("user_id", caller.userId)
        .eq("league_id", leagueId)
        .then(() => undefined, () => undefined);
    }
  }
  return NextResponse.json({ data: next });
}
