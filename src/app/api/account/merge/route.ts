import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCaller } from "@/lib/identity";

export const dynamic = "force-dynamic";

/**
 * One-time merge after first sign-in: fold the anonymous cookie session into
 * the account. Profile wins on conflicts; sid rows are re-keyed to user_id.
 */
export async function POST(req: Request) {
  const caller = await getCaller(req);
  if (!caller.userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const db = supabaseAdmin();

  const [{ data: sidSession }, { data: profile }] = await Promise.all([
    db.from("sessions").select("data").eq("sid", caller.sid).maybeSingle(),
    db.from("profiles").select("data").eq("user_id", caller.userId).maybeSingle(),
  ]);
  const sidData = (sidSession?.data as Record<string, unknown>) ?? {};
  const profileData = (profile?.data as Record<string, unknown>) ?? {};
  const merged: Record<string, unknown> = { ...sidData };
  for (const [k, v] of Object.entries(profileData)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof merged[k] === "object" && merged[k] !== null) {
      merged[k] = { ...(merged[k] as Record<string, unknown>), ...(v as Record<string, unknown>) }; // profile wins
    } else {
      merged[k] = v;
    }
  }
  await db.from("profiles").upsert({ user_id: caller.userId, data: merged, updated_at: new Date().toISOString() });

  // Re-key recent leagues; on conflict the account's row already exists — drop the sid copy.
  const { data: sidLeagues } = await db.from("user_leagues").select("*").eq("sid", caller.sid);
  for (const row of sidLeagues ?? []) {
    const { error } = await db
      .from("user_leagues")
      .update({ user_id: caller.userId, sid: null })
      .eq("id", row.id);
    if (error) await db.from("user_leagues").delete().eq("id", row.id);
  }

  await db.from("user_history").update({ user_id: caller.userId, sid: null }).eq("sid", caller.sid);

  return NextResponse.json({ ok: true, data: merged });
}
