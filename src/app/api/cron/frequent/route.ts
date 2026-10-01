import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ingestNews } from "@/lib/news";
import { sleeper } from "@/lib/sleeper";
import { ensureWeekProjections, ensureInjuryComments, ensureYtdStats } from "@/lib/ingest";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Hourly: the tagged news corpus the AI advisor reads, plus this week's
 * projections + live injury designations (Sleeper), ESPN injury report lines,
 * and season-to-date stats for the roster-needs engine.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const summary: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      summary[name] = await fn();
    } catch (e) {
      summary[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  await step("news", () => ingestNews(db));
  const state = await sleeper.state().catch(() => null);
  if (state && state.week >= 1) {
    const week = Math.min(18, state.week);
    await step("injuries", async () => ((await ensureWeekProjections(db, state.season, week, true)) ? "refreshed" : "fresh"));
    await step("injuryComments", () => ensureInjuryComments(db));
    await step("ytdStats", async () => ((await ensureYtdStats(db, state.season, true)) ? "refreshed" : "fresh"));
  }
  return NextResponse.json({ ok: true, ...summary });
}
