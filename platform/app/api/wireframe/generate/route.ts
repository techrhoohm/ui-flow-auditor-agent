import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You are an expert UI wireframe generator. Your only output is raw SVG elements — no wrappers, no markdown, no explanation.`;

const USER_PROMPT = `Analyze this webpage screenshot pixel-by-pixel and generate an SVG wireframe that precisely reproduces the page layout.

Coordinate space: viewBox 0 0 1280 900 (desktop viewport, top portion of the page)

RULES — follow strictly:
1. Output ONLY the inner SVG content — no <svg> tag, no markdown fences, no explanation
2. Use ONLY currentColor with fill-opacity / stroke-opacity — no hex colors, no rgb()
3. Every element's x/y/width/height must match the screenshot proportionally within the 1280×900 space
4. Element types to use:
   - Navigation bar: <rect> at top, fill="currentColor" fill-opacity="0.85" height ~50-60px
   - Logo/brand: small <rect> fill-opacity="0.8" in nav area
   - Nav links: row of thin <rect> elements fill-opacity="0.5" in nav
   - CTA buttons: <rect rx="6"> stroke="currentColor" stroke-opacity="0.6" fill="currentColor" fill-opacity="0.12"
   - Hero headline: 1-2 tall <rect> fill-opacity="0.7" width ~40-70% centered
   - Body text: rows of thin <rect> height="8-10" fill-opacity="0.25" varying widths
   - Subheadings: <rect> height="14-18" fill-opacity="0.55"
   - Images/media: <rect> fill-opacity="0.08" with two diagonal <line> elements (X pattern), stroke-opacity="0.15"
   - Cards: <rect> fill="none" stroke="currentColor" stroke-opacity="0.2" rx="8" with inner elements
   - Icons: <circle> or small <rect> fill-opacity="0.4" 16-24px
   - Dividers/rules: <line> stroke-opacity="0.12"
   - Inputs: <rect rx="4"> fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.3" height ~36px
   - Footer: <rect> fill-opacity="0.06" at bottom of viewport
5. Reproduce the ACTUAL layout — don't invent elements not visible in the screenshot
6. Group related elements with <g> tags for readability
7. Be precise: hero sections that span full width should be width="1280", nav should be y="0"

Output the SVG elements now:`;

type Body = { screenshot: string; nodeId?: string };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.my_claude;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.screenshot) {
    return NextResponse.json({ error: "screenshot required" }, { status: 400 });
  }

  // Strip the data URL prefix to get raw base64
  const base64 = body.screenshot.replace(/^data:image\/\w+;base64,/, "");
  // Detect media type
  const mediaTypeMatch = body.screenshot.match(/^data:(image\/\w+);base64,/);
  const mediaType = (mediaTypeMatch?.[1] ?? "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
    });

    const raw = response.content[0];
    if (raw.type !== "text") {
      return NextResponse.json({ error: "No SVG generated" }, { status: 500 });
    }

    let svg = raw.text.trim();

    // Strip markdown fences if present
    svg = svg.replace(/^```(?:svg|xml)?\s*/im, "").replace(/\s*```\s*$/im, "").trim();

    // If Claude wrapped it in a full <svg> tag, extract the inner content
    const outerMatch = svg.match(/^<svg[^>]*>([\s\S]*)<\/svg>\s*$/i);
    if (outerMatch) svg = outerMatch[1].trim();

    // Sanitize: strip any script tags (safety)
    svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "");

    // Wrap in a full themed SVG
    const fullSvg = `<svg viewBox="0 0 1280 900" xmlns="http://www.w3.org/2000/svg" style="color:var(--fg);background:var(--bg-elev);width:100%;height:100%;display:block">${svg}</svg>`;

    return NextResponse.json({ svg: fullSvg });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
