import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@evelab/eve-project", "@evelab/github", "@evelab/db", "@evelab/auth"],
  // Metadata is rendered blocking for every visitor, so title, canonical and Open Graph tags are always in
  // <head> of the raw HTML. By default Next streams them into <body> on dynamic pages for anything not on its
  // bot list, which includes Googlebot. Measured on the landing page, blocking costs about 2ms to first byte.
  // Setting this replaces Next's list rather than adding to it, which is why it matches everything.
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // EveLab frames sandbox previews, but nothing should frame EveLab.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default config;
