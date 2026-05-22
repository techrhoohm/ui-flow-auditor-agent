import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

// Triggers an agent run when GitHub pushes to the watched repo.
// Set AGENT_WEBHOOK_SECRET in Vercel env vars and use it in the GitHub webhook config.
export async function POST(req: Request) {
  const secret = process.env.AGENT_WEBHOOK_SECRET;

  if (secret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const raw = await req.text();
    const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    if (sig !== expected) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  }

  const event = req.headers.get("x-github-event");
  // Only act on push or deployment events
  if (event !== "push" && event !== "deployment") {
    return NextResponse.json({ skipped: true });
  }

  // Fire-and-forget: trigger the agent run
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  fetch(`${base}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).catch(() => {});

  return NextResponse.json({ triggered: true });
}
