import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth, isAuthEnabled } from "@evelab/auth";
import { eq, getDb, projectMembers, projects } from "@evelab/db";
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

export async function getAccount(): Promise<Account | undefined> {
  const auth = getAuth();
  if (!auth) return undefined;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return undefined;
  const { id, name, email, image } = session.user;
  return { id, name, email, image };
}

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

async function memberSlugs(userId: string): Promise<Set<string>> {
  const rows = await database()
    .select({ slug: projects.slug })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));
  return new Set(rows.map((row) => row.slug));
}

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
