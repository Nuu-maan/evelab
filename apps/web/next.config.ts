import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@evelab/eve-project", "@evelab/github", "@evelab/db", "@evelab/auth"],
};

export default config;
