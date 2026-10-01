import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computeNeeds, type NeedsResponse } from "@/lib/needs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type { NeedsResponse };

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rosterId = Number(new URL(req.url).searchParams.get("roster"));
  if (!/^\d{10,20}$/.test(id) || !(rosterId >= 1)) {
    return NextResponse.json({ error: "league and roster are required." }, { status: 400 });
  }
  const res = await computeNeeds(supabaseAdmin(), id, rosterId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res.data satisfies NeedsResponse);
}
