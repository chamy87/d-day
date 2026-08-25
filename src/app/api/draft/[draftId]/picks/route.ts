import { NextResponse } from "next/server";
import { sleeper } from "@/lib/sleeper";

export const dynamic = "force-dynamic";

/** Live draft state: polled by the draft room every 3s while drafting. */
export async function GET(_req: Request, ctx: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await ctx.params;
  if (!/^\d{10,20}$/.test(draftId)) {
    return NextResponse.json({ error: "Invalid draft id." }, { status: 400 });
  }
  try {
    const [draft, picks] = await Promise.all([sleeper.draft(draftId), sleeper.draftPicks(draftId)]);
    if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    // serverNow lets the client correct local clock skew so the countdown
    // tracks Sleeper's own deadline (last_picked + pick_timer).
    return NextResponse.json({ draft, picks, serverNow: Date.now() });
  } catch {
    return NextResponse.json({ error: "Sleeper is unreachable — try again." }, { status: 502 });
  }
}
