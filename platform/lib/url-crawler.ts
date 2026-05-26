import * as fs from "fs";
import * as os from "os";
import * as nodePath from "path";
import { AxeBuilder } from "@axe-core/playwright";
import { type Browser, type BrowserContext, type Page, type Video } from "playwright-core";
import { launchBrowser } from "./browser";

export type ClickableElement = {
  type: 'nav' | 'button' | 'link' | 'card';
  label: string;
  href?: string;
  bbox: { x: number; y: number; w: number; h: number };
  borderRadius: number;
};

export type CrawlPage = {
  id: string;
  url: string;
  title: string;
  depth: number;
  parentId: string | null;
  screenshot: string | null;
  findings: CrawlFinding[];
  elements: ClickableElement[];
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
  videos?: Record<string, string>; // nodeId -> base64 webm data URL (local only)
};

export type CrawlOptions = {
  maxPages?: number;
  perPageTimeoutMs?: number;
  totalTimeoutMs?: number;
  viewport?: { width: number; height: number };
  includeVideo?: boolean;
  onPage?: (page: CrawlPage, crawledSoFar: number) => void | Promise<void>;
};

// Vercel serverless has a 120s hard kill limit; stay well under it.
const IS_VERCEL = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const DEFAULT_OPTIONS: Omit<Required<CrawlOptions>, "onPage" | "includeVideo"> = {
  maxPages: 8,
  perPageTimeoutMs: IS_VERCEL ? 10000 : 18000,
  totalTimeoutMs: IS_VERCEL ? 50000 : 90000,
  viewport: { width: 1280, height: 800 },
};

const REALISTIC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// sec-ch-ua matching the UA string above
const SEC_CH_UA = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';

const BLOCK_PATTERNS: RegExp[] = [
  /unusual traffic/i,
  /are you a human/i,
  /access denied/i,
  /request (?:has been )?blocked/i,
  /verify you are human/i,
  /captcha/i,
  /just a moment/i,               // Cloudflare challenge page
  /enable javascript and cookies to continue/i,
  /sorry, you have been blocked/i,
  /why did this happen\?/i,       // Cloudflare block explanation
];

// Injects deep fingerprint overrides so the page sees a real Chrome browser.
// The stealth plugin handles most evasions; this covers the remaining gaps.
const STEALTH_INIT_SCRIPT = `
(() => {
  // Chrome runtime object — headless omits this entirely
  if (!window.chrome) {
    window.chrome = {
      app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
      runtime: { OnInstalledReason: {}, OnRestartRequiredReason: {}, PlatformArch: {}, PlatformNaclArch: {}, PlatformOs: {}, RequestUpdateCheckStatus: {} },
      loadTimes: function() { return {}; },
      csi: function() { return {}; },
    };
  }

  // Realistic plugin list — headless Chrome has none
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const arr = [
        { name: 'Chrome PDF Plugin',      filename: 'internal-pdf-viewer',  description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer',      filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client',          filename: 'internal-nacl-plugin',  description: '' },
      ];
      arr.forEach((p, i) => { Object.defineProperty(arr, i, { value: p }); });
      Object.defineProperty(arr, 'length', { value: arr.length });
      Object.defineProperty(arr, 'item',   { value: (i) => arr[i] ?? null });
      Object.defineProperty(arr, 'namedItem', { value: (n) => arr.find(p => p.name === n) ?? null });
      Object.defineProperty(arr, 'refresh', { value: () => {} });
      return arr;
    },
  });

  // Languages array — headless returns single-item array
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // Permissions — headless returns 'denied' for notifications, real Chrome returns 'default'
  const _query = Permissions.prototype.query;
  Permissions.prototype.query = function(params) {
    if (params && params.name === 'notifications') {
      return Promise.resolve({ state: 'default', onchange: null });
    }
    return _query.call(this, params);
  };

  // WebGL vendor/renderer — headless exposes SwiftShader (detectable)
  const _getParam = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(param) {
    if (param === 37445) return 'Intel Inc.';                         // UNMASKED_VENDOR_WEBGL
    if (param === 37446) return 'Intel Iris OpenGL Engine';           // UNMASKED_RENDERER_WEBGL
    return _getParam.call(this, param);
  };
  const _getParam2 = WebGL2RenderingContext.prototype.getParameter;
  WebGL2RenderingContext.prototype.getParameter = function(param) {
    if (param === 37445) return 'Intel Inc.';
    if (param === 37446) return 'Intel Iris OpenGL Engine';
    return _getParam2.call(this, param);
  };
})();
`;

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

  // Video recording: local only (Vercel has no VP8/VP9 encoder in @sparticuz/chromium)
  const videoDir = (!IS_VERCEL && opts.includeVideo)
    ? nodePath.join(os.tmpdir(), `crawl-vid-${startedAt}`)
    : null;
  if (videoDir) fs.mkdirSync(videoDir, { recursive: true });
  const pageVideoRefs = new Map<string, Video>();
  const videos: Record<string, string> = {};

  try {
    browser = await launchBrowser();
    // Slight viewport jitter so every run looks different to fingerprinters
    const vw = opts.viewport.width  + Math.floor(Math.random() * 40) - 20;
    const vh = opts.viewport.height + Math.floor(Math.random() * 20) - 10;
    const context = await browser.newContext({
      viewport: { width: vw, height: vh },
      userAgent: REALISTIC_UA,
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "sec-ch-ua": SEC_CH_UA,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
      },
      ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: vw, height: vh } } } : {}),
    });
    await context.addInitScript(STEALTH_INIT_SCRIPT);

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
          elements: result.elements,
        };
        pages.push(crawlPage);
        if (opts.onPage) await opts.onPage(crawlPage, pages.length);
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
          elements: [],
        });
        if (next.parentId) {
          edges.push({ source: next.parentId, target: nodeId });
        }
      } finally {
        if (videoDir) {
          const vid = page.video();
          if (vid) pageVideoRefs.set(nodeId, vid);
        }
        await page.close().catch(() => {});
      }
    }

    // Interactive pass — discover SPA routes via click navigation
    // Skip on Vercel: too slow given the 120s function limit
    if (!IS_VERCEL && Date.now() < deadline && pages.length < opts.maxPages) {
      const remaining = opts.maxPages - pages.length;
      if (remaining > 0) {
        try {
          const interactivePages = await exploreNavClicks(
            context,
            root.toString(),
            origin,
            visited,
            Math.min(remaining, 4),
            Math.min(opts.perPageTimeoutMs, 12000)
          );
          let ic = counter;
          for (const ip of interactivePages) {
            if (pages.length >= opts.maxPages) break;
            const newId = `interact-${++ic}`;
            visited.set(canonicalize(ip.url), newId);
            pages.push({ ...ip, id: newId, parentId: "entry" });
            edges.push({ source: "entry", target: newId });
          }
          counter = ic;
        } catch {
          // interactive pass is best-effort
        }
      }
    }

    await context.close();

    // After context.close(), video files are finalised — collect them
    if (videoDir && pageVideoRefs.size > 0) {
      for (const [nodeId, vid] of pageVideoRefs) {
        try {
          const vpath = await vid.path();
          const buf = fs.readFileSync(vpath);
          // Skip videos larger than 8 MB to stay within reasonable response bounds
          if (buf.length <= 8 * 1024 * 1024) {
            videos[nodeId] = `data:video/webm;base64,${buf.toString("base64")}`;
          }
        } catch { /* best-effort */ }
      }
      try { fs.rmSync(videoDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return {
    origin,
    startedAt,
    endedAt: Date.now(),
    pages,
    edges,
    ...(Object.keys(videos).length > 0 ? { videos } : {}),
  };
}

/**
 * Opens the entry page, finds nav elements, and clicks through them to discover
 * SPA routes that wouldn't appear in the static href BFS.
 */
async function exploreNavClicks(
  context: BrowserContext,
  entryUrl: string,
  origin: string,
  visited: Map<string, string>,
  maxNew: number,
  timeout: number
): Promise<Omit<CrawlPage, "id">[]> {
  const results: Omit<CrawlPage, "id">[] = [];
  const page = await context.newPage();

  try {
    page.setDefaultTimeout(timeout);
    await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout });
    await page
      .waitForLoadState("networkidle", { timeout: Math.min(4000, timeout) })
      .catch(() => {});

    // Gather nav targets
    type NavTarget = { href: string | null; text: string; index: number };
    const navTargets: NavTarget[] = await page.evaluate((rootOrigin) => {
      const selectors = [
        "nav a",
        "header a",
        "[role='tab']",
        "[role='menuitem']",
        "[role='navigation'] a",
        ".nav a",
        ".tabs a",
        ".navbar a",
        ".sidebar a",
        "a[class*='nav']",
        "a[class*='tab']",
      ];

      const SKIP_TEXT = /sign.?out|log.?out|delete|sign.?up|register/i;

      const seen = new Set<string>();
      const out: NavTarget[] = [];
      let globalIndex = 0;

      for (const sel of selectors) {
        const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const text = (el.textContent ?? "").trim();
          if (SKIP_TEXT.test(text)) continue;

          const anchor = el as HTMLAnchorElement;
          let href: string | null = null;
          if (anchor.href) {
            try {
              const u = new URL(anchor.href);
              if (u.origin === rootOrigin) href = u.toString();
              else if (anchor.href.startsWith("#") || anchor.href.startsWith("/")) {
                href = anchor.href;
              }
            } catch {
              href = null;
            }
          }

          const key = href ?? text;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          out.push({ href, text, index: globalIndex++ });
        }
      }

      return out.slice(0, 8);
    }, origin);

    for (const target of navTargets) {
      if (results.length >= maxNew) break;

      // If it has a same-origin href, navigate to it
      if (target.href && target.href.startsWith("http")) {
        const canonical = canonicalize(target.href);
        if (visited.has(canonical)) continue;
        try {
          await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: Math.min(8000, timeout) });
          await page
            .waitForLoadState("networkidle", { timeout: Math.min(3000, timeout) })
            .catch(() => {});
          const result = await capturePageState(page, target.href, timeout);
          if (result) results.push({ ...result, depth: 1, parentId: "entry" });
          // Navigate back
          await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: Math.min(6000, timeout) }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
        } catch {
          // skip failed nav
          await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: Math.min(6000, timeout) }).catch(() => {});
        }
        continue;
      }

      // SPA tab / button — click it
      try {
        const titleBefore = await page.title().catch(() => "");
        const urlBefore = page.url();

        const elements = await page.$$(
          `[role='tab'], [role='menuitem'], nav a, header a, .nav a, .tabs a, .navbar a, a[class*='nav'], a[class*='tab']`
        );
        // Re-query by text match
        let clicked = false;
        for (const el of elements) {
          const text = await el.textContent().catch(() => "");
          if (text?.trim() === target.text) {
            await el.click({ timeout: 2000 }).catch(() => {});
            clicked = true;
            break;
          }
        }
        if (!clicked) continue;

        await page.waitForTimeout(800);
        const urlAfter = page.url();
        const titleAfter = await page.title().catch(() => "");

        const urlChanged = canonicalize(urlAfter) !== canonicalize(urlBefore);
        const titleChanged = titleAfter !== titleBefore && titleAfter.trim() !== "";

        if (urlChanged || titleChanged) {
          const canonical = canonicalize(urlAfter);
          if (!visited.has(canonical)) {
            const result = await capturePageState(page, urlAfter, timeout);
            if (result) results.push({ ...result, depth: 1, parentId: "entry" });
          }
        }

        // Navigate back to entry for next iteration
        await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: Math.min(6000, timeout) }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
      } catch {
        // continue to next target
        await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: Math.min(6000, timeout) }).catch(() => {});
      }
    }
  } finally {
    await page.close().catch(() => {});
  }

  return results;
}

async function capturePageState(
  page: Page,
  url: string,
  timeoutMs: number
): Promise<Omit<CrawlPage, "id" | "depth" | "parentId" | "parentId"> | null> {
  try {
    const title = (await page.title()) || "(untitled)";
    const finalUrl = page.url() || url;

    // Scroll to trigger lazy loading
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let total = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, 500);
          total += 500;
          if (total >= Math.min(document.body.scrollHeight, 4000)) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 80);
      });
    }).catch(() => {});

    let screenshot: string | null = null;
    try {
      const buf = await page.screenshot({
        type: "jpeg",
        quality: 65,
        fullPage: true,
        clip: { x: 0, y: 0, width: 1280, height: Math.min(4000, 1280 * 3) },
      });
      screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 65, fullPage: false });
        screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
      } catch {
        screenshot = null;
      }
    }

    const [findings, elements] = await Promise.all([
      collectFindings(page, timeoutMs),
      collectClickableElements(page),
    ]);

    return { url: finalUrl, title, screenshot, findings, elements };
  } catch {
    return null;
  }
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
  elements: ClickableElement[];
}> {
  page.setDefaultTimeout(timeoutMs);
  const origin = new URL(url).origin;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page
    .waitForLoadState("networkidle", { timeout: Math.min(6000, timeoutMs) })
    .catch(() => {});

  const title = (await page.title()) || "(untitled)";
  const finalUrl = page.url();

  // ── Early block / blank detection ────────────────────────────────────
  // Run BEFORE the expensive scroll + axe pass so we don't burn 10–20s on
  // a Cloudflare challenge page or a spinner that never resolves.
  const earlyCheck = await page.evaluate(() => {
    const text = (document.body?.innerText ?? "").trim();
    const richEls = document.querySelectorAll(
      "div, section, article, main, p, h1, h2, h3, ul, ol, table"
    ).length;
    return { textLen: text.length, richEls, snippet: text.slice(0, 2000) };
  }).catch(() => ({ textLen: 0, richEls: 0, snippet: "" }));

  const combined = `${title}\n${earlyCheck.snippet}`;
  const blockedMatch = BLOCK_PATTERNS.find((re) => re.test(combined));
  // Blank = fewer than 200 chars of visible text AND fewer than 8 rich elements
  const isBlank = earlyCheck.textLen < 200 && earlyCheck.richEls < 8;

  if (blockedMatch || isBlank) {
    // Take a quick viewport-only screenshot so the canvas still shows something
    let screenshot: string | null = null;
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 65, fullPage: false });
      screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch { /* best-effort */ }

    const msg = blockedMatch
      ? `Bot protection detected — site served a block/captcha page (matched "${blockedMatch.source}"). Audit skipped to avoid burning timeout.`
      : `Page rendered with minimal content (${earlyCheck.textLen} chars, ${earlyCheck.richEls} elements) — likely blank, redirected to a login wall, or still loading. Audit skipped.`;

    return {
      finalUrl,
      title,
      screenshot,
      sameOriginLinks: [],
      findings: [{ rule: "automation-blocked", severity: "high" as const, message: msg, line: 1 }],
      elements: [],
    };
  }
  // ─────────────────────────────────────────────────────────────────────

  // Scroll to trigger lazy loading before screenshot
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, 500);
        total += 500;
        if (total >= Math.min(document.body.scrollHeight, 4000)) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 80);
    });
  }).catch(() => {});

  let screenshot: string | null = null;
  try {
    const buf = await page.screenshot({
      type: "jpeg",
      quality: 65,
      fullPage: true,
      clip: { x: 0, y: 0, width: 1280, height: Math.min(4000, 1280 * 3) },
    });
    screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 65, fullPage: false });
      screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {
      screenshot = null;
    }
  }

  // Improved link extraction: <a href>, [data-href], [href] on any element, router-link
  const sameOriginLinks = await page.evaluate((rootOrigin) => {
    const out = new Set<string>();

    // Standard anchors
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
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

    // data-href on any element
    const dataHrefEls = Array.from(document.querySelectorAll<HTMLElement>("[data-href]"));
    for (const el of dataHrefEls) {
      const rawHref = el.getAttribute("data-href");
      if (!rawHref) continue;
      try {
        const u = new URL(rawHref, rootOrigin);
        if (u.origin !== rootOrigin) continue;
        if (u.pathname.match(/\.(pdf|zip|png|jpg|jpeg|svg|css|js|webp)$/i)) continue;
        out.add(u.toString());
      } catch {
        // skip
      }
    }

    // href on non-anchor elements (buttons etc.)
    const hrefEls = Array.from(document.querySelectorAll<HTMLElement>("button[href], [role='button'][href]"));
    for (const el of hrefEls) {
      const rawHref = el.getAttribute("href");
      if (!rawHref) continue;
      try {
        const u = new URL(rawHref, rootOrigin);
        if (u.origin !== rootOrigin) continue;
        out.add(u.toString());
      } catch {
        // skip
      }
    }

    // router-link (Vue/Nuxt)
    const routerLinks = Array.from(document.querySelectorAll<HTMLElement>("router-link[to], [router-link]"));
    for (const el of routerLinks) {
      const to = el.getAttribute("to");
      if (!to) continue;
      try {
        const u = new URL(to, rootOrigin);
        if (u.origin !== rootOrigin) continue;
        out.add(u.toString());
      } catch {
        // skip
      }
    }

    return Array.from(out).slice(0, 16);
  }, origin);

  const [findings, elements] = await Promise.all([
    collectFindings(page, timeoutMs),
    collectClickableElements(page),
  ]);

  return { finalUrl, title, screenshot, sameOriginLinks, findings, elements };
}

async function collectClickableElements(page: Page): Promise<ClickableElement[]> {
  return page.evaluate(() => {
    interface RawEl {
      type: 'nav' | 'button' | 'link' | 'card';
      bbox: { x: number; y: number; w: number; h: number };
      borderRadius: number;
      href?: string;
    }

    function visible(r: DOMRect): boolean {
      return r.width >= 10 && r.height >= 10
        && r.top < 900 && r.bottom > 0
        && r.left < 1280 && r.right > 0;
    }
    function snap(r: DOMRect) {
      return {
        x: Math.round(r.left), y: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
      };
    }
    function getRadius(el: HTMLElement): number {
      try {
        const s = window.getComputedStyle(el);
        return Math.round(parseFloat(s.borderRadius || s.borderTopLeftRadius || '0') || 0);
      } catch { return 0; }
    }

    const raw: RawEl[] = [];
    const posKey = (b: { x: number; y: number; w: number; h: number }) =>
      `${b.x},${b.y},${b.w},${b.h}`;
    const seen = new Set<string>();

    function add(type: RawEl['type'], el: HTMLElement, href?: string) {
      const r = el.getBoundingClientRect();
      if (!visible(r)) return;
      const b = snap(r);
      const k = posKey(b);
      if (seen.has(k)) return;
      seen.add(k);
      raw.push({ type, bbox: b, borderRadius: getRadius(el), href });
    }

    // 1. Buttons — semantic + ARIA (highest priority)
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [role="button"], input[type="submit"], input[type="button"], input[type="reset"]'
    ))) add('button', el);

    // 2. Top-level nav items only — direct children of nav/header to avoid dropdown spam
    for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>(
      'nav > a, nav > ul > li > a, nav > div > a, header > a, header > nav > a,' +
      'header > nav > ul > li > a, [role="navigation"] > a, [role="navigation"] > ul > li > a'
    ))) add('nav', el as HTMLElement, (el as HTMLAnchorElement).href);

    // 3. Wider net for nav but max depth 3 inside nav/header containers
    for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>('nav a, header a'))) {
      // Only first-visible row (top 80px of page, or any nav link with large enough target)
      const r = el.getBoundingClientRect();
      if (r.height >= 32 || r.top < 80) add('nav', el as HTMLElement, (el as HTMLAnchorElement).href);
    }

    // 4. Click-handler non-anchor elements (cards, tiles, custom widgets)
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const tag = el.tagName.toUpperCase();
      if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'NAV'
        || tag === 'HEADER' || tag === 'BODY' || tag === 'HTML' || tag === 'MAIN'
        || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'DIV' && el.children.length > 6) continue;
      try {
        const s = window.getComputedStyle(el);
        if (s.cursor !== 'pointer') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 16 || r.width > 900 || r.height > 400) continue;
        add('card', el);
      } catch { /* skip */ }
    }

    // 5. Remaining links (standalone anchor links, not nav)
    for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const r = el.getBoundingClientRect();
      // Only block-ish links (not inline text links — width > 60 and height >= 20)
      if (r.width >= 60 && r.height >= 20) add('link', el as HTMLElement, (el as HTMLAnchorElement).href);
    }

    // Deduplicate: if element A fully contains element B (and B is meaningfully smaller), drop A
    const deduped = raw.filter((a, i) => {
      for (let j = 0; j < raw.length; j++) {
        if (i === j) continue;
        const b = raw[j];
        const areaA = a.bbox.w * a.bbox.h;
        const areaB = b.bbox.w * b.bbox.h;
        if (areaB >= areaA * 0.75) continue; // b not meaningfully smaller
        // Check b is fully inside a
        if (b.bbox.x >= a.bbox.x && b.bbox.y >= a.bbox.y
          && b.bbox.x + b.bbox.w <= a.bbox.x + a.bbox.w
          && b.bbox.y + b.bbox.h <= a.bbox.y + a.bbox.h) {
          return false; // a is a parent wrapper; drop it
        }
      }
      return true;
    });

    // Cap by type and interleave so visual isn't one-color dominated
    const byType = {
      button: deduped.filter(e => e.type === 'button').slice(0, 10),
      nav:    deduped.filter(e => e.type === 'nav').slice(0, 8),
      link:   deduped.filter(e => e.type === 'link').slice(0, 8),
      card:   deduped.filter(e => e.type === 'card').slice(0, 5),
    };

    return [...byType.button, ...byType.nav, ...byType.link, ...byType.card].map(e => ({
      type: e.type,
      label: e.type === 'button' ? 'btn' : e.type === 'nav' ? 'nav' : e.type === 'link' ? 'lnk' : 'crd',
      href: e.href,
      bbox: e.bbox,
      borderRadius: e.borderRadius,
    }));
  }).catch(() => []);
}

async function collectFindings(page: Page, timeoutMs: number): Promise<CrawlFinding[]> {
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
  }).catch(() => []);

  for (const h of heuristics) {
    findings.push({ ...h, line: 1 });
  }

  void timeoutMs; // used by caller for context
  return findings;
}
