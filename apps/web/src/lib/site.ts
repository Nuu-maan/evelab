import type { Metadata } from "next";

export const SITE_NAME = "EveLab";
export const SITE_TITLE = "EveLab: visual IDE for Eve agents";
export const SITE_DESCRIPTION =
  "An open source visual IDE for Eve agents. Draw an agent on a canvas and EveLab writes the TypeScript project, file for file, like eve init.";

/** Where EveLab is published. */
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
