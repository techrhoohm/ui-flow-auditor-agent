import type { Browser } from "playwright";

const IS_VERCEL = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const LOCAL_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-web-security",
  "--disable-features=IsolateOrigins,site-per-process",
];

// Lazily initialized so module-load failures don't crash the entire function.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _chromium: any = null;

async function getChromium() {
  if (!_chromium) {
    const { chromium } = await import("playwright-extra");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StealthPlugin = require("puppeteer-extra-plugin-stealth");
    chromium.use(StealthPlugin());
    _chromium = chromium;
  }
  return _chromium;
}

/**
 * Returns a stealth-wrapped Playwright Browser.
 * On Vercel/Lambda → uses @sparticuz/chromium binary.
 * Locally        → uses playwright-bundled Chromium.
 */
export async function launchBrowser(): Promise<Browser> {
  const chromium = await getChromium();

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
