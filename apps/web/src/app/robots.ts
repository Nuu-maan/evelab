import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * API routes are not pages, so crawlers skip them. /projects stays crawlable on
 * purpose: those pages answer with noindex, and a Disallow would hide it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
