import { NextResponse } from "next/server";
import { type Page } from "playwright";
import { launchBrowser } from "@/lib/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TIMEOUT_MS = 45_000;
const DEFAULT_TIMEOUT_MS = 20_000;

const REALISTIC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type RequestBody = {
  body?: string;
  url?: string;
  timeoutMs?: number;
};

export type ScriptRunStatus = "pass" | "fail" | "error";

export type ScriptRunResult = {
  status: ScriptRunStatus;
  durationMs: number;
  logs: LogEntry[];
  error?: string;
};

type LogEntry = { level: "log" | "warn" | "error"; message: string; at: number };

function validateUrl(input: string): URL {
  const trimmed = input.trim();
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const u = new URL(withScheme);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }
  return u;
}

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.body || !body.body.trim()) {
    return NextResponse.json({ error: "Empty script body." }, { status: 400 });
  }
  if (!body.url) {
    return NextResponse.json({ error: "Missing target url." }, { status: 400 });
  }
  let parsedUrl: URL;
  try {
    parsedUrl = validateUrl(body.url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bad URL." },
      { status: 400 }
    );
  }

  const timeoutMs = Math.min(
    Math.max(body.timeoutMs ?? DEFAULT_TIMEOUT_MS, 2000),
    MAX_TIMEOUT_MS
  );

  const start = Date.now();
  const logs: LogEntry[] = [];

  const pushLog = (level: LogEntry["level"], parts: unknown[]) => {
    logs.push({
      level,
      message: parts.map((p) => safeStringify(p)).join(" "),
      at: Date.now() - start,
    });
  };

  const sandboxedConsole = {
    log: (...args: unknown[]) => pushLog("log", args),
    warn: (...args: unknown[]) => pushLog("warn", args),
    error: (...args: unknown[]) => pushLog("error", args),
    info: (...args: unknown[]) => pushLog("log", args),
    debug: (...args: unknown[]) => pushLog("log", args),
  };

  let runner: ((args: {
    page: Page;
    url: string;
    console: typeof sandboxedConsole;
    expect: typeof tinyExpect;
  }) => Promise<unknown>) | null = null;

  try {
    const factory = new Function(
      "page",
      "url",
      "console",
      "expect",
      `return (async () => {\n${body.body}\n})()`
    ) as (
      page: Page,
      url: string,
      consoleLike: typeof sandboxedConsole,
      expect: typeof tinyExpect
    ) => Promise<unknown>;
    runner = ({ page, url, console: c, expect: e }) =>
      factory(page, url, c, e);
  } catch (err) {
    return NextResponse.json({
      status: "error" as ScriptRunStatus,
      durationMs: Date.now() - start,
      logs,
      error: `Script compile failed: ${err instanceof Error ? err.message : String(err)}`,
    } satisfies ScriptRunResult);
  }

  const browser = await launchBrowser()
    .catch((err: unknown) => {
      logs.push({
        level: "error",
        message: `Browser launch failed: ${err instanceof Error ? err.message : String(err)}`,
        at: 0,
      });
      return null;
    });

  if (!browser) {
    return NextResponse.json({
      status: "error" as ScriptRunStatus,
      durationMs: Date.now() - start,
      logs,
      error: "Could not launch chromium.",
    } satisfies ScriptRunResult);
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: REALISTIC_UA,
      locale: "en-US",
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    await page.goto(parsedUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    const runPromise = runner!({
      page,
      url: parsedUrl.toString(),
      console: sandboxedConsole,
      expect: tinyExpect,
    });

    let timedOut = false;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        timedOut = true;
        reject(new Error(`Script timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      await Promise.race([runPromise, timeoutPromise]);
      return NextResponse.json({
        status: "pass" as ScriptRunStatus,
        durationMs: Date.now() - start,
        logs,
      } satisfies ScriptRunResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({
        status: timedOut ? "error" : "fail",
        durationMs: Date.now() - start,
        logs,
        error: message,
      } satisfies ScriptRunResult);
    } finally {
      await context.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

const tinyExpect = (actual: unknown) => ({
  toBe(expected: unknown) {
    if (actual !== expected) {
      throw new Error(`expected ${safeStringify(actual)} to be ${safeStringify(expected)}`);
    }
  },
  toEqual(expected: unknown) {
    if (safeStringify(actual) !== safeStringify(expected)) {
      throw new Error(`expected ${safeStringify(actual)} to equal ${safeStringify(expected)}`);
    }
  },
  toBeTruthy() {
    if (!actual)
      throw new Error(`expected truthy value, got ${safeStringify(actual)}`);
  },
  toBeFalsy() {
    if (actual)
      throw new Error(`expected falsy value, got ${safeStringify(actual)}`);
  },
  toContain(needle: string) {
    if (typeof actual !== "string" || !actual.includes(needle)) {
      throw new Error(
        `expected ${safeStringify(actual)} to contain ${safeStringify(needle)}`
      );
    }
  },
  toMatch(re: RegExp) {
    if (typeof actual !== "string" || !re.test(actual)) {
      throw new Error(
        `expected ${safeStringify(actual)} to match ${re.toString()}`
      );
    }
  },
});

function safeStringify(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
