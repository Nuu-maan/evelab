import type { Metadata } from "next";

export const SITE_NAME = "evelab";
export const SITE_TITLE = "evelab: build AI agents visually, ship real code";
export const SITE_DESCRIPTION =
  "evelab is the open source visual IDE for AI agents built on Eve. Design multi-agent systems on a canvas, plug in tools, skills, MCP servers and chat channels, and ship production-ready TypeScript you fully own.";
export const REPOSITORY_URL = "https://github.com/anishfn/evelab";

/** Where evelab is published. */
export const PRODUCTION_URL = "https://evelab.vercel.app";

/**
 * The public origin, for canonical URLs, Open Graph and the sitemap.
 * NEXT_PUBLIC_SITE_URL wins when set. Any Vercel deployment, preview included,
 * points its canonicals at production. Locally it falls back to localhost.
 */
export function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured);
  if (process.env.VERCEL) return new URL(PRODUCTION_URL);
  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}

/**
 * Open Graph fields every page shares. Metadata merges shallowly, so a page
 * that sets its own openGraph spreads this rather than replacing it.
 */
export const OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  siteName: SITE_NAME,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  locale: "en_US",
};
