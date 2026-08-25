import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sleeper } from "@/lib/sleeper";
import { ensurePlayers, ensureProjections, ensureAdp } from "@/lib/ingest";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily warm of players, projections, and ADP across common formats. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const summary: Record<string, string> = {};
  const { season } = await sleeper.state();

  try {
    summary.players = (await ensurePlayers(db, true)) ? "refreshed" : "fresh";
  } catch (e) {
    summary.players = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
  try {
    summary.projections = (await ensureProjections(db, season, true)) ? "refreshed" : "fresh";
  } catch (e) {
    summary.projections = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
  for (const format of ["ppr", "half-ppr", "standard", "2qb"]) {
    try {
      summary[`adp:${format}`] = (await ensureAdp(db, format, 12, season, true)) ? "refreshed" : "fresh";
    } catch (e) {
      summary[`adp:${format}`] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({ ok: true, season, ...summary });
}
