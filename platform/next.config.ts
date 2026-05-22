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
    // puppeteer-extra-plugin transitive deps that NFT misses
    "merge-deep",
    "clone-deep",
    "is-plain-object",
    "isobject",
    "arr-union",
    "for-own",
    "for-in",
    "kind-of",
    "is-buffer",
    "lazy-cache",
    "shallow-clone",
    "is-extendable",
    "mixin-object",
    "debug",
    "ms",
  ],
  // Turbopack's NFT can't follow dynamic require() chains in the stealth plugin
  // ecosystem — include the entire dependency tree explicitly for each route.
  outputFileTracingIncludes: (() => {
    const stealthBundle = [
      "./node_modules/playwright-core/browsers.json",
      "./node_modules/playwright-extra/**/*",
      "./node_modules/puppeteer-extra/**/*",
      "./node_modules/puppeteer-extra-plugin/**/*",
      "./node_modules/puppeteer-extra-plugin-stealth/**/*",
      "./node_modules/merge-deep/**/*",
      "./node_modules/clone-deep/**/*",
      "./node_modules/is-plain-object/**/*",
      "./node_modules/isobject/**/*",
      "./node_modules/arr-union/**/*",
      "./node_modules/for-own/**/*",
      "./node_modules/for-in/**/*",
      "./node_modules/kind-of/**/*",
      "./node_modules/is-buffer/**/*",
      "./node_modules/lazy-cache/**/*",
      "./node_modules/shallow-clone/**/*",
      "./node_modules/is-extendable/**/*",
      "./node_modules/mixin-object/**/*",
      "./node_modules/debug/**/*",
      "./node_modules/ms/**/*",
    ];
    return {
      "/api/audit/url": stealthBundle,
      "/api/test/run": stealthBundle,
      "/api/agent/run": stealthBundle,
    };
  })(),
};

export default nextConfig;
