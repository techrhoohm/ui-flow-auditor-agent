import { NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { getAgentConfig } from "@/lib/agent-store";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Called by Vercel Cron at the schedule in vercel.json.
// Resolves target list and fans out one QStash message per target so each
// crawl runs in its own function invocation (no chained timeouts).
// Falls back to a direct call when QSTASH_TOKEN is not set (local dev).
export async function GET(req: Request) {
  // Vercel injects Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getAgentConfig();
  const targets = config.targets.filter((t) => t.enabled);

  if (targets.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No enabled targets" });
  }

  // Stable production URL — VERCEL_PROJECT_PRODUCTION_URL is set on Pro,
  // otherwise fall back to APP_URL (user-configured) or VERCEL_URL.
  const baseUrl =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";

  const qToken = process.env.QSTASH_TOKEN;

  if (!qToken) {
    // Local dev / no QStash: fire direct call (all targets, same function)
    fetch(`${baseUrl}/api/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
    return NextResponse.json({ dispatched: targets.map((t) => t.id), mode: "direct" });
  }

  const client = new Client({ token: qToken });
  const dispatched: string[] = [];

  for (const target of targets) {
    await client.publishJSON({
      url: `${baseUrl}/api/agent/run`,
      body: { targetId: target.id },
      retries: 2,
    });
    dispatched.push(target.id);
  }

  return NextResponse.json({ dispatched, mode: "qstash" });
}
