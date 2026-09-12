import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@evelab/eve-project", "@evelab/github"],
  webpack(config) {
    // Workspace packages are TypeScript source with ESM-style ".js" specifiers.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default config;
