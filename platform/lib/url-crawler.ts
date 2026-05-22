import { AxeBuilder } from "@axe-core/playwright";
import { type Browser, type BrowserContext, type Page } from "playwright";
import { launchBrowser } from "./browser";

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
  onPage?: (page: CrawlPage, crawledSoFar: number) => void | Promise<void>;
};

// Vercel serverless has a 120s hard kill limit; stay well under it.
const IS_VERCEL = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const DEFAULT_OPTIONS: Omit<Required<CrawlOptions>, "onPage"> = {
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
        });
        if (next.parentId) {
          edges.push({ source: next.parentId, target: nodeId });
        }
      } finally {
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
): Promise<Omit<CrawlPage, "id" | "depth" | "parentId"> | null> {
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

    const findings = await collectFindings(page, timeoutMs);

    return { url: finalUrl, title, screenshot, findings };
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
}> {
  page.setDefaultTimeout(timeoutMs);
  const origin = new URL(url).origin;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page
    .waitForLoadState("networkidle", { timeout: Math.min(6000, timeoutMs) })
    .catch(() => {});

  const title = (await page.title()) || "(untitled)";
  const finalUrl = page.url();

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

  const findings = await collectFindings(page, timeoutMs);

  return { finalUrl, title, screenshot, sameOriginLinks, findings };
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
