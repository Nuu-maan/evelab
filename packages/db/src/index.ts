import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";

let client: ReturnType<typeof postgres> | undefined;

/**
 * Returns the database, or undefined when DATABASE_URL is unset.
 *
 * EveLab runs locally against the filesystem without Postgres; the database is
 * only needed once accounts, GitHub links and run history come into play.
 */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  client ??= postgres(url, { max: 5 });
  return drizzle(client, { schema });
}

// Query helpers for callers that should not depend on Drizzle directly.
export { and, eq, inArray } from "drizzle-orm";
