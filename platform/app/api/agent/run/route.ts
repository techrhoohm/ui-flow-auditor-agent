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

type Body = { targetId?: string };

// --- GitHub issue filing ---
async function fileGitHubIssues(
  findings: { nodeLabel: string; severity: string; message: string }[],
  target: string
): Promise<number> {
  const token = process.env.AGENT_GITHUB_TOKEN;
  const owner = process.env.AGENT_GITHUB_OWNER;
  const repo = process.env.AGENT_GITHUB_REPO;
  if (!token || !owner || !repo || !findings.length) return 0;

  let filed = 0;
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
    if (res.ok) filed++;
  }
  return filed;
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
      const filed = await fileGitHubIssues(filtered, target.url);
      run.issuesFiled = filed;
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
  let body: Body = {};
  try { body = await req.json(); } catch { /* no body = run all */ }

  const config = await getAgentConfig();
  const targets = config.targets.filter(
    (t) => t.enabled && (!body.targetId || t.id === body.targetId)
  );

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
