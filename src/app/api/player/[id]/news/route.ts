import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Latest cached headlines tagged with this player (expandable-row detail). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9]{1,20}$/.test(id)) {
    return NextResponse.json({ error: "Invalid player id." }, { status: 400 });
  }
  const { data } = await supabaseAdmin()
    .from("news_cache")
    .select("title,source,url,published_at")
    .contains("player_ids", [id])
    .order("published_at", { ascending: false })
    .limit(3);
  return NextResponse.json({ items: data ?? [] });
}
