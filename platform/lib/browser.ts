import { chromium } from "playwright-extra";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
import type { Browser } from "playwright";

// Register stealth evasions once at module level
chromium.use(StealthPlugin());

const IS_VERCEL = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const LOCAL_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-web-security",
  "--disable-features=IsolateOrigins,site-per-process",
];

/**
 * Returns a stealth-wrapped Playwright Browser.
 * On Vercel/Lambda → uses @sparticuz/chromium binary.
 * Locally        → uses playwright-bundled Chromium.
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
      args: [...sparticuz.args, "--no-sandbox", "--disable-blink-features=AutomationControlled"],
      executablePath: await sparticuz.executablePath(),
      headless: true,
    }) as unknown as Browser;
  }
  return chromium.launch({ headless: true, args: LOCAL_ARGS }) as unknown as Browser;
}
