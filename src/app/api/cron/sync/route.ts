import { NextResponse, type NextRequest } from "next/server";
import { syncAllMailboxes } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called by Vercel Cron (see vercel.json). Vercel sends CRON_SECRET as a bearer token.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await syncAllMailboxes();
  return NextResponse.json({ results });
}
