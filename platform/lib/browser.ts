import type { Browser } from "playwright";

const IS_VERCEL = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const LOCAL_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-web-security",
  "--disable-features=IsolateOrigins,site-per-process",
];

/**
 * Returns a Playwright Browser instance.
 * On Vercel/Lambda → uses @sparticuz/chromium binary.
 * Locally         → uses the playwright-bundled Chromium.
 * Stealth evasions are applied per-context in url-crawler.ts via addInitScript.
 */
export async function launchBrowser(): Promise<Browser> {
  if (IS_VERCEL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sparticuz = require("@sparticuz/chromium") as {
      args: string[];
      executablePath: () => Promise<string>;
    };
    const { chromium } = await import("playwright-core");
    return chromium.launch({
      args: [...sparticuz.args, "--no-sandbox", "--disable-blink-features=AutomationControlled"],
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }

  const { chromium } = await import("playwright-core");
  return chromium.launch({ headless: true, args: LOCAL_ARGS });
}
