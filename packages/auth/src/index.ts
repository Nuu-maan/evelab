import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@evelab/db";

/**
 * GitHub sign-in.
 *
 * Auth is optional: with no DATABASE_URL and no GitHub OAuth app, EveLab runs
 * as a local single-user tool against the filesystem. Once those are set, this
 * becomes the session source for project ownership.
 *
 * Client secrets and GitHub App private keys are read here, on the server only.
 * Never import this module from a client component.
 */
export function getAuth() {
  const db = getDb();
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!db || !clientId || !clientSecret) return undefined;

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    socialProviders: {
      github: { clientId, clientSecret },
    },
    session: { expiresIn: 60 * 60 * 24 * 30 },
  });
}

export type Auth = NonNullable<ReturnType<typeof getAuth>>;

/** True when sign-in is configured; the UI uses this to decide what to show. */
export function isAuthEnabled(): boolean {
  return Boolean(
    process.env.DATABASE_URL && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
  );
}
