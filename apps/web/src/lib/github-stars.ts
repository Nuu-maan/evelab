import { unstable_cache } from "next/cache";
import { REPOSITORY_URL } from "@/lib/site";

const REPO = new URL(REPOSITORY_URL).pathname.slice(1);

/**
 * The repository's star count for the header, asked of GitHub at most once an
 * hour. Anything going wrong just leaves the count out; the button never waits
 * on GitHub or breaks without it.
 */
export const githubStars = unstable_cache(
  async (): Promise<number | undefined> => {
    try {
      const response = await fetch(`https://api.github.com/repos/${REPO}`, {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) return undefined;
      const data = (await response.json()) as { stargazers_count?: unknown };
      return typeof data.stargazers_count === "number" ? data.stargazers_count : undefined;
    } catch {
      return undefined;
    }
  },
  ["github-stars", REPO],
  { revalidate: 3600 },
);

/** 950, 1.2k, 12k: short enough for a header button. */
export function formatStars(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, "") : Math.round(thousands)}k`;
}
