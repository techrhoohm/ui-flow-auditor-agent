import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "@axe-core/playwright",
    "@sparticuz/chromium",
    "axe-core",
    "sharp",
    "pixelmatch",
  ],
  // playwright-core loads browsers.json via a computed path that Vercel's file
  // tracer can't follow statically — include it explicitly so the file lands in
  // /var/task/node_modules/playwright-core/browsers.json at runtime.
  outputFileTracingIncludes: {
    "/api/audit/url": ["./node_modules/playwright-core/browsers.json"],
    "/api/test/run": ["./node_modules/playwright-core/browsers.json"],
  },
};

export default nextConfig;
