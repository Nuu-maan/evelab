import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth, isAuthEnabled } from "@evelab/auth";
import { account as accounts, and, eq, getDb, projectMembers, projects } from "@evelab/db";
import { AccessError, decideAccess, type AccessDecision } from "@/lib/access";

/**
 * Sessions and project ownership.
 *
 * Every function here is a no-op in local mode, so the app behaves exactly as
 * it does without a database. When sign-in is on, the database says who owns a
 * workspace directory; the directory itself stays the source of truth for the
 * project.
 */

export interface Account {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export { isAuthEnabled };

/** The signed-in account, looked up once per request however many checks ask. */
export const getAccount = cache(async (): Promise<Account | undefined> => {
  const auth = getAuth();
  if (!auth) return undefined;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return undefined;
  const { id, name, email, image } = session.user;
  return { id, name, email, image };
});

/** For pages outside a project. Sends a signed-out visitor to sign in; undefined in local mode. */
export async function requireAccount(): Promise<Account | undefined> {
  if (!isAuthEnabled()) return undefined;
  const account = await getAccount();
  if (!account) redirect("/sign-in");
  return account;
}

/** For server actions that act outside a project, such as creating or importing one. */
export async function requireSignedIn(): Promise<void> {
  if (isAuthEnabled() && !(await getAccount())) throw new AccessError("sign-in");
}

function database() {
  const db = getDb();
  if (!db) throw new Error("Sign-in is configured without a database.");
  return db;
}

/** Project slugs an account belongs to, queried once per request per account. */
const memberSlugs = cache(async (userId: string): Promise<Set<string>> => {
  const rows = await database()
    .select({ slug: projects.slug })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));
  return new Set(rows.map((row) => row.slug));
});

export async function checkProjectAccess(projectId: string): Promise<AccessDecision> {
  if (!isAuthEnabled()) return decideAccess({ authEnabled: false });
  const account = await getAccount();
  const member = account ? (await memberSlugs(account.id)).has(projectId) : false;
  return decideAccess({ authEnabled: true, signedIn: Boolean(account), member });
}

/** For server actions, which can be called directly and must not trust the page that rendered them. */
export async function requireProjectAccess(projectId: string): Promise<void> {
  const decision = await checkProjectAccess(projectId);
  if (decision !== "allow") throw new AccessError(decision);
}

/** For project pages: a project the visitor may not open is a 404, not a sign-in prompt. */
export async function requireProjectPage(projectId: string): Promise<void> {
  if ((await checkProjectAccess(projectId)) !== "allow") notFound();
}

/** Project ids the visitor may see, or undefined for all of them in local mode. */
export async function visibleProjectIds(): Promise<Set<string> | undefined> {
  if (!isAuthEnabled()) return undefined;
  const account = await getAccount();
  return account ? memberSlugs(account.id) : new Set();
}

/** Records a newly created workspace directory as the signed-in user's project. */
export async function recordProject(slug: string, name: string): Promise<void> {
  if (!isAuthEnabled()) return;
  const account = await getAccount();
  if (!account) throw new AccessError("sign-in");
  const id = crypto.randomUUID();
  await database().transaction(async (tx) => {
    await tx.insert(projects).values({ id, slug, name, ownerId: account.id });
    await tx.insert(projectMembers).values({ projectId: id, userId: account.id, role: "owner" });
  });
}

export async function forgetProject(slug: string): Promise<void> {
  if (!isAuthEnabled()) return;
  await database().delete(projects).where(eq(projects.slug, slug));
}

export interface GitHubAccess {
  token: string;
  /** Whether the person granted repository access, which import, commit and push need. */
  canUseRepositories: boolean;
}

function hasRepoScope(scope: string | null | undefined): boolean {
  return (scope ?? "").split(/[\s,]+/).includes("repo");
}

/** The scopes GitHub says a token carries, or undefined when GitHub cannot be asked. */
async function grantedScopes(token: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${process.env.GITHUB_API_URL ?? "https://api.github.com"}/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return undefined;
    return (response.headers.get("x-oauth-scopes") ?? "")
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean)
      .join(",");
  } catch {
    return undefined;
  }
}

/** The signed-in person's GitHub OAuth token, read on the server only. Undefined when they have none. */
export async function githubAccess(userId: string): Promise<GitHubAccess | undefined> {
  const [row] = await database()
    .select({ id: accounts.id, token: accounts.accessToken, scope: accounts.scope })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "github")))
    .limit(1);
  if (!row?.token) return undefined;
  if (hasRepoScope(row.scope)) return { token: row.token, canUseRepositories: true };

  // Better Auth refreshes the token on every sign-in but keeps the scope saved at the first one,
  // so a column without repo is checked against GitHub and corrected when the token has it.
  const granted = await grantedScopes(row.token);
  const canUseRepositories = hasRepoScope(granted);
  if (canUseRepositories) {
    await database().update(accounts).set({ scope: granted, updatedAt: new Date() }).where(eq(accounts.id, row.id));
  }
  return { token: row.token, canUseRepositories };
}
