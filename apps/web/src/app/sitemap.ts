import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Only the landing and templates pages are public: projects are private to each
 * account and sign-in is noindex. There is no lastModified, because there is no real
 * content date to report and a build time would claim a change that never happened.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/templates"].map((path) => ({ url: new URL(path, siteUrl()).toString() }));
}
