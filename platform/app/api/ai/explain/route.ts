import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  message: string;
  severity: string;
  nodeLabel: string;
  model?: string;
};

const client = new Anthropic();

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const body = (await req.json()) as Body;
  const { message, severity, nodeLabel, model = "claude-sonnet-4-6" } = body;

  const prompt = `You are Nora, a silent and detail-oriented UX auditor. A finding was detected on the screen "${nodeLabel}".

Finding [${severity.toUpperCase()}]: ${message}

Explain this finding in exactly 2 sentences — what it means and why it matters.
Then on a new line write: Fix: followed by one concrete, actionable fix.
No markdown. No bullet points. No extra lines.`;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const explanation = (response.content[0] as { type: string; text: string }).text.trim();
    return NextResponse.json({ explanation });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
