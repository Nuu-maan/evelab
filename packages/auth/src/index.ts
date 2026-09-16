import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { account, getDb, session, user, verification } from "@evelab/db";

// The web app mounts the handler without depending on Better Auth directly.
export { toNextJsHandler } from "better-auth/next-js";

/**
 * GitHub sign-in.
 *
 * Auth is optional: without a database, a GitHub OAuth app and a secret, evelab
 * runs as a local single-user tool against the filesystem. Once all of them are
 * set, this becomes the session source for project ownership.
 *
 * Client secrets are read here, on the server only. Never import this module
 * from a client component.
 */

/** True when sign-in is fully configured. Anything less and evelab stays in local mode. */
export function isAuthEnabled(): boolean {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.BETTER_AUTH_SECRET,
  );
}

function createAuth(db: NonNullable<ReturnType<typeof getDb>>, clientId: string, clientSecret: string) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    socialProviders: {
      // repo lets evelab list, import, commit and push with each person's own GitHub access.
      github: { clientId, clientSecret, scope: ["read:user", "user:email", "repo"] },
    },
    session: { expiresIn: 60 * 60 * 24 * 30 },
    // Lets server actions set the session cookie through Next's cookie store.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** The Better Auth instance, or undefined in local mode. Built once per server process. */
export function getAuth(): Auth | undefined {
  if (!isAuthEnabled()) return undefined;
  const db = getDb();
  if (!db) return undefined;
  instance ??= createAuth(db, process.env.GITHUB_CLIENT_ID!, process.env.GITHUB_CLIENT_SECRET!);
  return instance;
}
