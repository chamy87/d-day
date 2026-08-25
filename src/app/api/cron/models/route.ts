import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { env } from "@/lib/env";

// Runs on the default Node.js runtime (Fluid Compute). Scheduled via
// vercel.json crons; Vercel sends "Authorization: Bearer $CRON_SECRET".
export const dynamic = "force-dynamic";

type ModelRow = {
  provider: string;
  model_id: string;
  display_name: string | null;
  is_default: boolean;
  capabilities: unknown;
  created_at_provider: string | null;
  updated_at: string;
};

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const summary: Record<string, number | string> = {};

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic();
      const rows: ModelRow[] = [];
      for await (const m of client.models.list()) {
        rows.push({
          provider: "anthropic",
          model_id: m.id,
          display_name: m.display_name,
          is_default: m.id === "claude-opus-5",
          capabilities: null,
          created_at_provider: m.created_at,
          updated_at: now,
        });
      }
      const { error } = await db
        .from("ai_models")
        .upsert(rows, { onConflict: "provider,model_id" });
      if (error) throw new Error(error.message);
      summary.anthropic = rows.length;
    } catch (e) {
      summary.anthropic = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    summary.anthropic = "skipped (no ANTHROPIC_API_KEY)";
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
      const data = (await res.json()) as {
        data: { id: string; created: number }[];
      };
      const chatModels = data.data
        .filter((m) => m.id.startsWith("gpt-"))
        .filter((m) => !/audio|realtime|image|transcribe|tts|search/.test(m.id))
        .sort((a, b) => b.created - a.created);
      const rows: ModelRow[] = chatModels.map((m, i) => ({
        provider: "openai",
        model_id: m.id,
        display_name: m.id,
        is_default: i === 0,
        capabilities: null,
        created_at_provider: new Date(m.created * 1000).toISOString(),
        updated_at: now,
      }));
      const { error } = await db
        .from("ai_models")
        .upsert(rows, { onConflict: "provider,model_id" });
      if (error) throw new Error(error.message);
      summary.openai = rows.length;
    } catch (e) {
      summary.openai = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    summary.openai = "skipped (no OPENAI_API_KEY)";
  }

  return NextResponse.json({ ok: true, refreshed_at: now, ...summary });
}
