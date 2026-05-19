import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Finding = { message: string; severity: "high" | "medium" | "low" };
type Body = {
  nodeId: string;
  nodeLabel: string;
  nodeKind: string;
  findings: Finding[];
  model?: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.my_claude;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }
  const client = new Anthropic({ apiKey });

  const body = (await req.json()) as Body;
  const { nodeLabel, nodeKind, findings, model = "claude-sonnet-4-6" } = body;

  const findingsText =
    findings.length > 0
      ? findings.map((f) => `[${f.severity.toUpperCase()}] ${f.message}`).join("\n")
      : "No findings from automated audit.";

  const prompt = `You are Nora, a silent and detail-oriented QA engineer. You are auditing a screen called "${nodeLabel}" (kind: ${nodeKind}).

Based on the automated audit findings below, generate 3 to 5 test cases for this screen.

Findings:
${findingsText}

Return ONLY a valid JSON array — no markdown fences, no explanation, nothing else.
Each element must have exactly these keys:
- "title": string (one-line description of what is being tested)
- "body": string (numbered steps + expected outcome, plain text, newlines OK)
- "priority": "P0" | "P1" | "P2"
- "type": "functional" | "visual" | "a11y" | "perf"

Think like a QA engineer who notices what others miss. Cover edge cases, empty states, and accessibility.`;

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonText = raw.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
    const suggestions = JSON.parse(jsonText) as unknown[];

    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
