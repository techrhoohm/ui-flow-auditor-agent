import { NextResponse } from "next/server";
import { getAgentConfig, setAgentConfig } from "@/lib/agent-store";
import type { AgentConfig } from "@/lib/agent-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getAgentConfig();
  return NextResponse.json(config);
}

export async function POST(req: Request) {
  let body: AgentConfig;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  await setAgentConfig(body);
  return NextResponse.json({ ok: true });
}
