import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  description: string;
  nodeLabel: string;
  nodeUrl?: string;
  model?: string;
};

const client = new Anthropic();

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const body = (await req.json()) as Body;
  const { description, nodeLabel, nodeUrl, model = "claude-sonnet-4-6" } = body;

  if (!description?.trim()) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  const prompt = `You are an expert in Playwright test automation.

Generate a Playwright script body for the following test. The script runs inside an async function that already has access to:
- \`page\`: Playwright Page (already navigated to the target URL)
- \`url\`: string (the target URL)
- \`console\`: { log, warn, error } (captured — use instead of console.log)
- \`expect\`: object with matchers: toBe, toEqual, toBeTruthy, toBeFalsy, toContain, toMatch

Rules:
- No imports. No function declarations. No top-level await wrapping.
- Throw an Error to fail. Completing without throw = pass.
- Use await for all async calls.
- Return ONLY the raw script body — no markdown fences, no explanation, no comments beyond inline context.

Test description: ${description}
Screen: ${nodeLabel}
Target URL: ${nodeUrl ?? "unknown"}`;

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    let body = (message.content[0] as { type: string; text: string }).text.trim();
    body = body.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();

    const name = description.slice(0, 60).trim();
    return NextResponse.json({ name, body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
