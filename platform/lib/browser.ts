import { chromium } from "playwright";
import type { Browser } from "playwright";

const IS_VERCEL = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const LOCAL_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
];

/**
 * Returns a Playwright Browser instance.
 * On Vercel/Lambda → uses @sparticuz/chromium (Lambda-compatible binary).
 * Locally → uses the playwright-bundled Chromium.
 */
export async function launchBrowser(): Promise<Browser> {
  if (IS_VERCEL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sparticuz = require("@sparticuz/chromium") as {
      args: string[];
      executablePath: () => Promise<string>;
      headless: boolean;
    };
    return chromium.launch({
      args: [...sparticuz.args, "--no-sandbox"],
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }
  return chromium.launch({ headless: true, args: LOCAL_ARGS });
}
