import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCaller, callerKey, withSidCookie } from "@/lib/identity";

export const dynamic = "force-dynamic";

const KINDS = new Set(["trade_eval", "draft_recap", "waiver_claim"]);

export type HistoryItem = {
  id: number;
  leagueId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export async function GET(req: Request) {
  const caller = await getCaller(req);
  const key = callerKey(caller);
  const url = new URL(req.url);
  const league = url.searchParams.get("league");
  const kind = url.searchParams.get("kind");
  const limit = Math.min(50, Number(url.searchParams.get("limit")) || 20);

  let q = supabaseAdmin()
    .from("user_history")
    .select("id,league_id,kind,payload,created_at")
    .eq(key.column, key.value)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (league) q = q.eq("league_id", league);
  if (kind) q = q.eq("kind", kind);
  const { data } = await q;

  const items: HistoryItem[] = (data ?? []).map((r) => ({
    id: r.id,
    leagueId: r.league_id,
    kind: r.kind,
    payload: r.payload as Record<string, unknown>,
    createdAt: r.created_at,
  }));
  return withSidCookie(NextResponse.json({ items }), caller.sid);
}

export async function POST(req: Request) {
  const caller = await getCaller(req);
  const key = callerKey(caller);
  let body: { leagueId?: string; kind?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const { leagueId, kind, payload } = body;
  if (!leagueId || !kind || !KINDS.has(kind) || !payload) {
    return NextResponse.json({ error: "leagueId, kind and payload are required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  // Draft recaps are one-per-draft: skip when a snapshot already exists.
  if (kind === "draft_recap" && payload.draftId) {
    const { data: existing } = await db
      .from("user_history")
      .select("id,payload")
      .eq(key.column, key.value)
      .eq("league_id", leagueId)
      .eq("kind", "draft_recap");
    if ((existing ?? []).some((r) => (r.payload as { draftId?: string }).draftId === payload.draftId)) {
      return withSidCookie(NextResponse.json({ ok: true, deduped: true }), caller.sid);
    }
  }

  await db.from("user_history").insert({
    [key.column]: key.value,
    league_id: leagueId,
    kind,
    payload,
  });
  return withSidCookie(NextResponse.json({ ok: true }), caller.sid);
}
