import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type TestCaseInput = {
  id: string;
  title: string;
  body: string;
  priority: string;
  type: string;
};

type Body = {
  testCases: TestCaseInput[];
  screenshotUrl: string | null;
  nodeUrl: string | null;
  nodeLabel: string;
  model?: string;
};

type EvalResult = {
  id: string;
  status: "pass" | "fail" | "blocked" | "skip";
  reasoning: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.my_claude;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }
  const client = new Anthropic({ apiKey });

  const body = (await req.json()) as Body;
  const { testCases, screenshotUrl, nodeUrl, nodeLabel, model = "claude-sonnet-4-6" } = body;

  if (!testCases || testCases.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const casesText = testCases
    .map((tc, i) =>
      `[${i + 1}] ID: ${tc.id}\nTitle: ${tc.title}\nType: ${tc.type} | Priority: ${tc.priority}\nSteps:\n${tc.body || "(no steps specified)"}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are Nora, a silent and surgical QA auditor. You evaluate UI test cases against visual evidence and determine whether they pass, fail, are blocked, or should be skipped.

Rules:
- "pass": The screenshot and context clearly show the expected behaviour is met.
- "fail": The screenshot or context clearly shows the expected behaviour is NOT met.
- "blocked": You cannot determine pass/fail (screenshot missing, steps require login/interaction you cannot observe, or prerequisite state is unavailable).
- "skip": The test case is irrelevant to this screen (e.g. it tests a different feature entirely).

Be precise. Do not be optimistic. If something is ambiguous, lean towards "blocked" rather than guessing.

Return ONLY a valid JSON array — no markdown, no explanation. Each element:
{ "id": "<original id>", "status": "pass"|"fail"|"blocked"|"skip", "reasoning": "<one to two sentences, factual>" }`;

  const userLines: Anthropic.MessageParam["content"] = [];

  userLines.push({
    type: "text",
    text: `Screen: "${nodeLabel}"${nodeUrl ? ` (${nodeUrl})` : ""}\n\nEvaluate these ${testCases.length} test case${testCases.length === 1 ? "" : "s"}:\n\n${casesText}`,
  });

  if (screenshotUrl && screenshotUrl.startsWith("data:image/")) {
    const [header, base64] = screenshotUrl.split(",");
    const mediaType = (header.match(/data:(image\/\w+);/) ?? [])[1] as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | undefined;
    if (base64 && mediaType) {
      userLines.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
      userLines.push({ type: "text", text: "The screenshot above is the current state of this screen." });
    }
  } else {
    userLines.push({ type: "text", text: "No screenshot is available for this screen. Evaluate based on context only." });
  }

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userLines }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonText = raw.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
    const results = JSON.parse(jsonText) as EvalResult[];
    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
