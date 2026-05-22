import { NextResponse } from "next/server";
import { getCurrentRun, getLastRun, getLastBatch } from "@/lib/agent-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [current, last, allLastRuns] = await Promise.all([getCurrentRun(), getLastRun(), getLastBatch()]);
  return NextResponse.json({ current: current ?? null, last: last ?? null, allLastRuns });
}
