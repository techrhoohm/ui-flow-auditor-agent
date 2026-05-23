import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { crawlSite, validateUrl } from "@/lib/url-crawler";
import { getAgentConfig, upsertRun, finalizeRun, saveLastBatch } from "@/lib/agent-store";
import type { AgentRun } from "@/lib/agent-store";
import type { AgentTarget } from "@/lib/agent-config";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = { targetId?: string; targets?: AgentTarget[] };

// --- GitHub issue filing ---
async function fileGitHubIssues(
  findings: { nodeLabel: string; severity: string; message: string }[],
  target: string
): Promise<{ filed: number; urls: string[] }> {
  const token = process.env.AGENT_GITHUB_TOKEN;
  const owner = process.env.AGENT_GITHUB_OWNER;
  const repo = process.env.AGENT_GITHUB_REPO;
  if (!token || !owner || !repo || !findings.length) return { filed: 0, urls: [] };

  let filed = 0;
  const urls: string[] = [];
  for (const f of findings) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `[Agent][${f.severity.toUpperCase()}] ${f.nodeLabel}: ${f.message.slice(0, 80)}`,
        body: [
          `**Screen:** ${f.nodeLabel}`,
          `**Severity:** ${f.severity.toUpperCase()}`,
          `**Target:** \`${target}\``,
          "",
          f.message,
          "",
          "_Autonomously filed by [UI Flow Auditor Agent](https://github.com/techrhoohm/ui-flow-auditor-agent)_",
        ].join("\n"),
        labels: [`severity: ${f.severity}`, "automated-audit"],
      }),
    });
    if (res.ok) {
      filed++;
      const data = await res.json() as { html_url?: string };
      if (data.html_url) urls.push(data.html_url);
    }
  }
  return { filed, urls };
}

// --- Slack notification ---
async function postSlack(text: string): Promise<void> {
  const webhook = process.env.AGENT_SLACK_WEBHOOK;
  if (!webhook) return;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

// --- AI analysis of findings ---
async function aiSuggest(
  findings: { rule: string; message: string; severity: string }[],
  url: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !findings.length) return "";

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `You are a UI/UX auditor. Briefly summarize these findings for ${url} in 2-3 sentences, focusing on the most critical issues:\n\n${findings.map((f) => `- [${f.severity}] ${f.rule}: ${f.message}`).join("\n")}`,
    }],
  });
  const block = msg.content[0];
  return block?.type === "text" ? block.text : "";
}

// --- Run audit for a single target ---
async function runTarget(
  run: AgentRun,
  target: AgentTarget,
  config: Awaited<ReturnType<typeof getAgentConfig>>
): Promise<AgentRun> {
  const log = (msg: string) => {
    run.log.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
    run.updatedAt = Date.now();
  };

  try {
    // Step 1: Crawl
    run.state = "crawling";
    log(`Crawling ${target.url}…`);
    await upsertRun(run);

    const parsed = validateUrl(target.url);
    run.partialCrawl = [];
    const crawl = await crawlSite(parsed.toString(), {
      maxPages: 6,
      onPage: async (page, count) => {
        let path = page.url;
        try { path = new URL(page.url).pathname || "/"; } catch { /* keep raw */ }
        run.partialCrawl!.push({
          id: page.id,
          label: page.title || path,
          url: page.url,
          screenshot: page.screenshot,
        });
        log(`Crawled ${count}/6 — ${path}`);
        run.updatedAt = Date.now();
        await upsertRun(run);
      },
    });
    run.pagesFound = crawl.pages.length;
    log(`Found ${crawl.pages.length} page(s)`);

    if (crawl.pages.length === 0) {
      run.state = "error";
      run.error = "Crawler returned 0 pages — site may be bot-protected.";
      log(run.error);
      return run;
    }

    // Step 2: Analyze
    run.state = "analyzing";
    await upsertRun(run);

    const allFindings = crawl.pages.flatMap((p) =>
      p.findings.map((f) => ({ ...f, nodeLabel: p.title || p.url }))
    );
    const filtered = allFindings.filter((f) => {
      const rank = { low: 1, medium: 2, high: 3 };
      return rank[f.severity] >= rank[config.thresholds.minSeverity];
    });
    run.issuesFound = filtered.length;
    log(`${filtered.length} finding(s) above threshold`);

    // Store crawl result (including screenshots) so UI can load into canvas
    run.crawlResult = {
      nodes: crawl.pages.map((p, i) => ({
        id: p.id,
        label: p.title || new URL(p.url).pathname || "/",
        url: p.url,
        position: { x: 80 + (i % 3) * 320, y: 80 + Math.floor(i / 3) * 240 },
        screenshot: p.screenshot ?? null,
      })),
      edges: crawl.edges.map((e) => ({ source: e.source, target: e.target })),
      findings: filtered.map((f) => ({
        nodeId: crawl.pages.find((p) => (p.title || p.url) === f.nodeLabel)?.id ?? "",
        nodeLabel: f.nodeLabel,
        severity: f.severity,
        message: f.message,
        rule: f.rule,
      })),
    };

    let summary = "";
    if (filtered.length > 0) {
      summary = await aiSuggest(filtered, target.url);
      if (summary) {
      for (const line of summary.split("\n").filter(Boolean).slice(0, 8)) {
        log(`AI: ${line}`);
      }
      if (run.crawlResult) run.crawlResult.aiSummary = summary;
    }
    }

    // Step 3: Report
    run.state = "reporting";
    await upsertRun(run);

    if (config.notifications.github && filtered.length > 0) {
      const { filed, urls } = await fileGitHubIssues(filtered, target.url);
      run.issuesFiled = filed;
      run.issueUrls = urls;
      log(`Filed ${filed} GitHub issue(s)`);
    }

    if (config.notifications.slack) {
      const icon = filtered.length > 0 ? "⚠️" : "✅";
      await postSlack(
        `${icon} *UI Flow Agent — ${target.name}*\n` +
        `Pages: ${crawl.pages.length} · Findings: ${filtered.length} · Filed: ${run.issuesFiled}\n` +
        (summary ? `\n_${summary}_` : "") +
        `\n<${target.url}|View target>`
      );
      log("Slack notified");
    }

    run.state = "done";
    log("Done.");
  } catch (err) {
    run.state = "error";
    run.error = err instanceof Error ? err.message : "Unknown error";
    run.log.push(`ERROR: ${run.error}`);
  }

  return run;
}

// --- Route handler ---
export async function POST(req: Request) {
  try {
    return await handleRun(req);
  } catch (err) {
    console.error("[agent/run] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleRun(req: Request) {
  let body: Body = {};

  // Read body once — needed for both signature verification and JSON parsing.
  const rawBody = await req.text().catch(() => "");

  // QStash signature verification: only enforced when both signing keys are
  // configured AND the Upstash-Signature header is present (i.e. QStash sent
  // this request). Direct calls from the UI bypass verification intentionally.
  const qSig = req.headers.get("Upstash-Signature");
  const qCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const qNext = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (qSig && qCurrent && qNext) {
    const { Receiver } = await import("@upstash/qstash");
    const receiver = new Receiver({ currentSigningKey: qCurrent, nextSigningKey: qNext });
    const valid = await receiver.verify({ signature: qSig, body: rawBody }).catch(() => false);
    if (!valid) return NextResponse.json({ error: "Invalid QStash signature" }, { status: 401 });
  }

  try { body = rawBody ? (JSON.parse(rawBody) as Body) : {}; } catch { /* no body = run all */ }

  // UI "Run Now" passes targets inline to avoid cold-start config loss.
  // QStash/cron passes targetId and looks up from stored config (requires Redis).
  const config = await getAgentConfig();
  const targets: AgentTarget[] = body.targets && body.targets.length > 0
    ? body.targets.filter((t) => t.enabled)
    : config.targets.filter((t) => t.enabled && (!body.targetId || t.id === body.targetId));

  if (targets.length === 0) {
    return NextResponse.json({ error: "No enabled targets configured." }, { status: 400 });
  }

  const results: AgentRun[] = [];

  for (const target of targets) {
    const run: AgentRun = {
      runId: randomUUID(),
      state: "queued",
      targetId: target.id,
      url: target.url,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      pagesFound: 0,
      issuesFound: 0,
      issuesFiled: 0,
      log: [],
    };

    await upsertRun(run);
    const finished = await runTarget(run, target, config);
    await finalizeRun(finished);
    results.push(finished);
  }

  await saveLastBatch(results);
  return NextResponse.json({ runs: results });
}
