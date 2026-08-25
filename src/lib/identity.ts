import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase";

/**
 * Caller identity for account-aware routes. Auth is an upgrade, never a
 * gate: every caller has an anonymous cookie sid; a valid Supabase access
 * token (Authorization: Bearer) upgrades the caller to a user id.
 */
export const SID_COOKIE = "dday_sid";
const YEAR = 60 * 60 * 24 * 365;

export async function ensureSid(): Promise<{ sid: string; isNew: boolean }> {
  const jar = await cookies();
  const existing = jar.get(SID_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return { sid: existing, isNew: false };
  return { sid: randomUUID(), isNew: true };
}

export function withSidCookie<T>(res: NextResponse<T>, sid: string): NextResponse<T> {
  res.cookies.set(SID_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: YEAR,
    path: "/",
  });
  return res;
}

export type Caller = { userId: string | null; sid: string; isNewSid: boolean };

export async function getCaller(req: Request): Promise<Caller> {
  let userId: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    try {
      const { data } = await supabaseAdmin().auth.getUser(auth.slice(7));
      userId = data.user?.id ?? null;
    } catch {
      userId = null;
    }
  }
  const { sid, isNew } = await ensureSid();
  return { userId, sid, isNewSid: isNew };
}

/** Column filter for the caller: user rows when signed in, else sid rows. */
export function callerKey(caller: Caller): { column: "user_id" | "sid"; value: string } {
  return caller.userId ? { column: "user_id", value: caller.userId } : { column: "sid", value: caller.sid };
}
