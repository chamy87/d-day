import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE = "dday_sid";
const YEAR = 60 * 60 * 24 * 365;

/**
 * Anonymous per-browser session (no-login product). The httpOnly cookie keys
 * a prefs row in Supabase so concurrent users never collide and choices
 * survive localStorage wipes.
 */
async function ensureSid(): Promise<{ sid: string; isNew: boolean }> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return { sid: existing, isNew: false };
  return { sid: randomUUID(), isNew: true };
}

function withCookie(res: NextResponse, sid: string): NextResponse {
  res.cookies.set(COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: YEAR,
    path: "/",
  });
  return res;
}

export async function GET() {
  const { sid, isNew } = await ensureSid();
  let data: Record<string, unknown> = {};
  if (!isNew) {
    const { data: row } = await supabaseAdmin().from("sessions").select("data").eq("sid", sid).maybeSingle();
    data = (row?.data as Record<string, unknown>) ?? {};
  }
  return withCookie(NextResponse.json({ data }), sid);
}

export async function PUT(req: Request) {
  const { sid } = await ensureSid();
  let merge: Record<string, unknown>;
  try {
    merge = ((await req.json()) as { merge?: Record<string, unknown> }).merge ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: row } = await db.from("sessions").select("data").eq("sid", sid).maybeSingle();
  const current = (row?.data as Record<string, unknown>) ?? {};
  // Shallow merge per top-level key; one level deep for objects (e.g. teams map).
  const next: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(merge)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof next[k] === "object" && next[k] !== null) {
      next[k] = { ...(next[k] as Record<string, unknown>), ...(v as Record<string, unknown>) };
    } else {
      next[k] = v;
    }
  }
  await db
    .from("sessions")
    .upsert({ sid, data: next, updated_at: new Date().toISOString() });
  return withCookie(NextResponse.json({ data: next }), sid);
}
