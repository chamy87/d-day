import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ingestNews } from "@/lib/news";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Hourly: refresh the tagged news corpus the AI advisor reads. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  try {
    const res = await ingestNews(db);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
