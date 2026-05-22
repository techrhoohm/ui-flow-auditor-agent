import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@axe-core/playwright",
    "@sparticuz/chromium",
    "axe-core",
    "sharp",
    "pixelmatch",
  ],
  // playwright-core loads browsers.json via a computed path and @sparticuz/chromium
  // resolves its binary dynamically — include them explicitly for Vercel's NFT.
  outputFileTracingIncludes: (() => {
    const playwrightBundle = [
      "./node_modules/playwright-core/**/*",
      "./node_modules/playwright/**/*",
    ];
    return {
      "/api/audit/url": playwrightBundle,
      "/api/test/run": playwrightBundle,
      "/api/agent/run": playwrightBundle,
    };
  })(),
};

export default nextConfig;
