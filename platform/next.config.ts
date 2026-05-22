import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra",
    "puppeteer-extra-plugin",
    "puppeteer-extra-plugin-stealth",
    "@axe-core/playwright",
    "@sparticuz/chromium",
    "axe-core",
    "sharp",
    "pixelmatch",
    "merge-deep",
    "clone-deep",
    "is-plain-object",
  ],
  // Turbopack's NFT can't follow dynamic require() chains in puppeteer-extra
  // and its transitive deps — include the full ecosystem explicitly.
  outputFileTracingIncludes: {
    "/api/audit/url": [
      "./node_modules/playwright-core/browsers.json",
      "./node_modules/playwright-extra/**/*",
      "./node_modules/puppeteer-extra/**/*",
      "./node_modules/puppeteer-extra-plugin/**/*",
      "./node_modules/puppeteer-extra-plugin-stealth/**/*",
      "./node_modules/merge-deep/**/*",
      "./node_modules/clone-deep/**/*",
      "./node_modules/is-plain-object/**/*",
    ],
    "/api/test/run": [
      "./node_modules/playwright-core/browsers.json",
      "./node_modules/playwright-extra/**/*",
      "./node_modules/puppeteer-extra/**/*",
      "./node_modules/puppeteer-extra-plugin/**/*",
      "./node_modules/puppeteer-extra-plugin-stealth/**/*",
      "./node_modules/merge-deep/**/*",
      "./node_modules/clone-deep/**/*",
      "./node_modules/is-plain-object/**/*",
    ],
    "/api/agent/run": [
      "./node_modules/playwright-core/browsers.json",
      "./node_modules/playwright-extra/**/*",
      "./node_modules/puppeteer-extra/**/*",
      "./node_modules/puppeteer-extra-plugin/**/*",
      "./node_modules/puppeteer-extra-plugin-stealth/**/*",
      "./node_modules/merge-deep/**/*",
      "./node_modules/clone-deep/**/*",
      "./node_modules/is-plain-object/**/*",
    ],
  },
};

export default nextConfig;
