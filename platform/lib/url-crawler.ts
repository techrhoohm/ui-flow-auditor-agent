import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "playwright";

export type CrawlPage = {
  id: string;
  url: string;
  title: string;
  depth: number;
  parentId: string | null;
  screenshot: string | null;
  findings: CrawlFinding[];
};

export type CrawlFinding = {
  rule: string;
  severity: "low" | "medium" | "high";
  message: string;
  line: number;
};

export type CrawlResult = {
  origin: string;
  startedAt: number;
  endedAt: number;
  pages: CrawlPage[];
  edges: { source: string; target: string }[];
};

export type CrawlOptions = {
  maxPages?: number;
  perPageTimeoutMs?: number;
  totalTimeoutMs?: number;
  viewport?: { width: number; height: number };
};

const DEFAULT_OPTIONS: Required<CrawlOptions> = {
  maxPages: 8,
  perPageTimeoutMs: 18000,
  totalTimeoutMs: 90000,
  viewport: { width: 1280, height: 800 },
};

const REALISTIC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BLOCK_PATTERNS: RegExp[] = [
  /unusual traffic/i,
  /are you a human/i,
  /access denied/i,
  /request (?:has been )?blocked/i,
  /verify you are human/i,
  /captcha/i,
  /cloudflare/i,
  /just a moment/i,
  /enable javascript and cookies to continue/i,
];

const impactToSeverity = (impact: string | null): CrawlFinding["severity"] => {
  if (impact === "critical" || impact === "serious") return "high";
  if (impact === "moderate") return "medium";
  return "low";
};

const titleCaseRule = (id: string) =>
  id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export function validateUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty URL.");
  const withScheme = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("Not a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }
  return parsed;
}

export async function crawlSite(
  rawUrl: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const root = validateUrl(rawUrl);
  const origin = root.origin;
  const startedAt = Date.now();
  const deadline = startedAt + opts.totalTimeoutMs;

  let browser: Browser | null = null;
  const pages: CrawlPage[] = [];
  const edges: { source: string; target: string }[] = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const context = await browser.newContext({
      viewport: opts.viewport,
      userAgent: REALISTIC_UA,
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const visited = new Map<string, string>(); // canonical URL -> nodeId
    const queue: Array<{ url: string; depth: number; parentId: string | null }> = [
      { url: root.toString(), depth: 0, parentId: null },
    ];

    let counter = 0;
    while (queue.length > 0 && pages.length < opts.maxPages) {
      if (Date.now() > deadline) break;
      const next = queue.shift()!;
      const canonical = canonicalize(next.url);
      if (visited.has(canonical)) {
        if (next.parentId) {
          edges.push({ source: next.parentId, target: visited.get(canonical)! });
        }
        continue;
      }

      const nodeId = pages.length === 0 ? "entry" : `page-${++counter}`;
      visited.set(canonical, nodeId);

      const page = await context.newPage();
      try {
        const result = await visit(page, next.url, opts.perPageTimeoutMs);
        const crawlPage: CrawlPage = {
          id: nodeId,
          url: result.finalUrl,
          title: result.title,
          depth: next.depth,
          parentId: next.parentId,
          screenshot: result.screenshot,
          findings: result.findings,
        };
        pages.push(crawlPage);
        if (next.parentId) {
          edges.push({ source: next.parentId, target: nodeId });
        }

        if (next.depth < 2 && pages.length < opts.maxPages) {
          for (const link of result.sameOriginLinks) {
            if (visited.has(canonicalize(link))) continue;
            queue.push({ url: link, depth: next.depth + 1, parentId: nodeId });
            if (queue.length + pages.length >= opts.maxPages) break;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pages.push({
          id: nodeId,
          url: next.url,
          title: "(failed to load)",
          depth: next.depth,
          parentId: next.parentId,
          screenshot: null,
          findings: [
            {
              rule: "page-load-failed",
              severity: "high",
              message: `Page did not load: ${msg.split("\n")[0]}`,
              line: 1,
            },
          ],
        });
        if (next.parentId) {
          edges.push({ source: next.parentId, target: nodeId });
        }
      } finally {
        await page.close().catch(() => {});
      }
    }

    await context.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return {
    origin,
    startedAt,
    endedAt: Date.now(),
    pages,
    edges,
  };
}

function canonicalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let path = u.pathname.replace(/\/$/, "");
    if (path === "") path = "/";
    return `${u.origin}${path}${u.search}`;
  } catch {
    return url;
  }
}

async function visit(
  page: Page,
  url: string,
  timeoutMs: number
): Promise<{
  finalUrl: string;
  title: string;
  screenshot: string | null;
  sameOriginLinks: string[];
  findings: CrawlFinding[];
}> {
  page.setDefaultTimeout(timeoutMs);
  const origin = new URL(url).origin;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page
    .waitForLoadState("networkidle", { timeout: Math.min(6000, timeoutMs) })
    .catch(() => {});

  const title = (await page.title()) || "(untitled)";
  const finalUrl = page.url();

  let screenshot: string | null = null;
  try {
    const buf = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false });
    screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    screenshot = null;
  }

  const bodyText = await page
    .evaluate(() => document.body?.innerText?.slice(0, 4000) ?? "")
    .catch(() => "");
  const combined = `${title}\n${bodyText}`;
  const blockedMatch = BLOCK_PATTERNS.find((re) => re.test(combined));
  if (blockedMatch) {
    return {
      finalUrl,
      title,
      screenshot,
      sameOriginLinks: [],
      findings: [
        {
          rule: "automation-blocked",
          severity: "high",
          message: `Site detected the headless browser and served a block / captcha page (matched "${blockedMatch.source}"). Audit results are not reliable until the request is allowed.`,
          line: 1,
        },
      ],
    };
  }

  const sameOriginLinks = await page.evaluate((rootOrigin) => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const out = new Set<string>();
    for (const a of anchors) {
      try {
        const href = a.href;
        if (!href) continue;
        const u = new URL(href);
        if (u.origin !== rootOrigin) continue;
        if (u.pathname.match(/\.(pdf|zip|png|jpg|jpeg|svg|css|js|webp)$/i)) continue;
        out.add(u.toString());
      } catch {
        // skip
      }
    }
    return Array.from(out).slice(0, 12);
  }, origin);

  const findings: CrawlFinding[] = [];

  try {
    const axe = new AxeBuilder({ page });
    const result = await axe
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    for (const violation of result.violations.slice(0, 6)) {
      findings.push({
        rule: violation.id,
        severity: impactToSeverity(violation.impact ?? null),
        message: `${titleCaseRule(violation.id)}: ${violation.help} (${violation.nodes.length} ${
          violation.nodes.length === 1 ? "element" : "elements"
        })`,
        line: 1,
      });
    }
  } catch (err) {
    findings.push({
      rule: "axe-failed",
      severity: "low",
      message: `Accessibility scan did not complete: ${
        err instanceof Error ? err.message : String(err)
      }`,
      line: 1,
    });
  }

  const heuristics = await page.evaluate(() => {
    const out: Array<{ rule: string; severity: "low" | "medium" | "high"; message: string }> =
      [];

    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[href], [role="button"], input[type="button"], input[type="submit"]'
      )
    );
    let tinyTargets = 0;
    for (const el of buttons) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 32 || r.height < 32) tinyTargets++;
    }
    if (tinyTargets > 0) {
      out.push({
        rule: "tap-target-too-small",
        severity: "medium",
        message: `${tinyTargets} tappable element${
          tinyTargets === 1 ? "" : "s"
        } under 32×32px. Mobile users will mis-tap.`,
      });
    }

    if (!document.querySelector("h1")) {
      out.push({
        rule: "missing-h1",
        severity: "low",
        message: "No <h1> on this page. Screen readers and SEO suffer.",
      });
    }

    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input, textarea, select"));
    const unlabeled = inputs.filter((i) => {
      if (i.type === "hidden" || i.type === "submit" || i.type === "button") return false;
      const id = i.id;
      if (id && document.querySelector(`label[for="${id}"]`)) return false;
      if (i.closest("label")) return false;
      if (i.getAttribute("aria-label")) return false;
      if (i.getAttribute("aria-labelledby")) return false;
      return true;
    });
    if (unlabeled.length > 0) {
      out.push({
        rule: "unlabeled-input",
        severity: "medium",
        message: `${unlabeled.length} form input${
          unlabeled.length === 1 ? "" : "s"
        } without an associated label.`,
      });
    }

    const dest = Array.from(document.querySelectorAll("button, a")).filter((el) => {
      const t = (el.textContent ?? "").trim().toLowerCase();
      return t === "delete" || t === "delete account" || t === "remove account";
    });
    const signOut = Array.from(document.querySelectorAll("button, a")).filter((el) => {
      const t = (el.textContent ?? "").trim().toLowerCase();
      return t === "sign out" || t === "log out" || t === "logout";
    });
    if (dest.length > 0 && signOut.length > 0) {
      out.push({
        rule: "destructive-proximity",
        severity: "high",
        message:
          "Destructive action (Delete) and Sign Out both visible on the same page. One mis-tap.",
      });
    }

    return out;
  });

  for (const h of heuristics) {
    findings.push({ ...h, line: 1 });
  }

  return { finalUrl, title, screenshot, sameOriginLinks, findings };
}
