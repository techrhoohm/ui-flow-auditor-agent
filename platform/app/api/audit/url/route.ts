import { NextResponse } from "next/server";
import type { AuditEvent, AuditScript, Severity } from "@/lib/audit-script";
import { crawlSite, validateUrl, type CrawlResult, type ClickableElement } from "@/lib/url-crawler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RequestBody = { url?: string; maxPages?: number };

const SEVERITY_DURATION: Record<Severity, number> = {
  low: 1600,
  medium: 1800,
  high: 2000,
};

const severityRank = (s: Severity) =>
  s === "high" ? 3 : s === "medium" ? 2 : 1;

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = validateUrl(body.url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid URL." },
      { status: 400 }
    );
  }

  const maxPages = Math.min(Math.max(body.maxPages ?? 6, 1), 10);

  try {
    const crawl = await crawlSite(parsed.toString(), { maxPages });
    if (crawl.pages.length === 0) {
      return NextResponse.json(
        { error: `No pages could be loaded from ${parsed.origin}. The site may be blocking automated browsers (bot protection, CAPTCHA, or IP block). Try a different URL.` },
        { status: 422 }
      );
    }
    const { script, nodes, edges, screenshots, elementMap } = buildResponse(crawl);
    return NextResponse.json({
      script,
      nodes,
      edges,
      screenshots,
      elementMap,
      meta: {
        origin: crawl.origin,
        pagesScanned: crawl.pages.length,
        durationMs: crawl.endedAt - crawl.startedAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = /timeout|ETIMEDOUT|deadline/i.test(message);
    return NextResponse.json(
      {
        error: isTimeout
          ? `Crawl timed out loading ${parsed.hostname}. The site may be slow, blocking automated browsers, or returning large pages. Try again or use a simpler URL.`
          : `Crawl failed: ${message}`,
      },
      { status: 500 }
    );
  }
}

type ResponseNode = {
  id: string;
  label: string;
  kind: "entry" | "tab" | "detail";
  position: { x: number; y: number };
  hasScreenshot: boolean;
  url: string;
};

function buildResponse(crawl: CrawlResult): {
  script: AuditScript;
  nodes: ResponseNode[];
  edges: { source: string; target: string }[];
  screenshots: Record<string, string>;
  elementMap: Record<string, ClickableElement[]>;
} {
  const target = `URL · ${crawl.origin.replace(/^https?:\/\//, "")}`;

  const positions = layoutTree(crawl.pages);
  const screenshots: Record<string, string> = {};
  const elementMap: Record<string, ClickableElement[]> = {};
  const nodes: ResponseNode[] = crawl.pages.map((p) => {
    if (p.screenshot) screenshots[p.id] = p.screenshot;
    if (p.elements?.length) elementMap[p.id] = p.elements;
    return {
      id: p.id,
      label: shortenLabel(p.title || p.url),
      kind: p.id === "entry" ? "entry" : p.depth === 1 ? "tab" : "detail",
      position: positions[p.id] ?? { x: 0, y: 0 },
      hasScreenshot: !!p.screenshot,
      url: p.url,
    };
  });

  const events: AuditEvent[] = [];
  events.push({
    kind: "start",
    utterance: `Starting. ${crawl.pages.length} pages discovered.`,
    durationMs: 1400,
  });

  let total = 0;
  let highCount = 0;
  for (const page of crawl.pages) {
    events.push({
      kind: "scan",
      nodeId: page.id,
      utterance: shortenLabel(page.title || page.url),
      durationMs: 1000,
    });
    const sorted = [...page.findings].sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity)
    );
    for (const f of sorted.slice(0, 5)) {
      total++;
      if (f.severity === "high") highCount++;
      events.push({
        kind: "finding",
        nodeId: page.id,
        severity: f.severity,
        utterance: f.message,
        durationMs: SEVERITY_DURATION[f.severity],
      });
    }
  }

  events.push({
    kind: "end",
    utterance:
      total === 0
        ? "Clean. Nothing to report."
        : `${total} findings. ${highCount} high.`,
    durationMs: 1800,
  });

  return {
    script: { target, events },
    nodes,
    edges: crawl.edges,
    screenshots,
    elementMap,
  };
}

function shortenLabel(input: string): string {
  if (!input) return "(untitled)";
  const trimmed = input.length > 36 ? input.slice(0, 33) + "…" : input;
  return trimmed.trim();
}

function layoutTree(
  pages: Array<{ id: string; depth: number }>
): Record<string, { x: number; y: number }> {
  const byDepth = new Map<number, string[]>();
  for (const p of pages) {
    const list = byDepth.get(p.depth) ?? [];
    list.push(p.id);
    byDepth.set(p.depth, list);
  }
  const out: Record<string, { x: number; y: number }> = {};
  const xSpacing = 200;
  const ySpacing = 240;
  for (const [depth, ids] of byDepth) {
    const totalWidth = (ids.length - 1) * xSpacing;
    const startX = -totalWidth / 2;
    ids.forEach((id, i) => {
      out[id] = {
        x: startX + i * xSpacing + 480,
        y: depth * ySpacing + 40,
      };
    });
  }
  return out;
}
