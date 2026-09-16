import { createHash } from "node:crypto";

/**
 * The id Git gives a file's content. Comparing it with the ids in a tree tells
 * evelab which files changed without downloading anything.
 */
export function gitBlobSha(content: string): string {
  const body = Buffer.from(content, "utf8");
  return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
}
