import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "@axe-core/playwright", "axe-core", "sharp", "pixelmatch"],
};

export default nextConfig;
