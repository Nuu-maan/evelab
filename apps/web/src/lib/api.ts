import "server-only";
import { checkProjectAccess } from "@/lib/session";
import { projectExists } from "@/lib/workspace";

const PROJECT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Route handlers check access themselves, like server actions. A project the
 * caller may not open answers exactly like one that does not exist.
 */
export async function guardProject(projectId: string): Promise<Response | undefined> {
  if (!PROJECT_ID.test(projectId) || !(await projectExists(projectId))) return jsonError("Project not found.", 404);
  if ((await checkProjectAccess(projectId)) !== "allow") return jsonError("Project not found.", 404);
  return undefined;
}

/** Reads a JSON body, or undefined when it is missing or malformed. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** eve answers errors as JSON with `error` or `message`; fall back to the status. */
export async function upstreamError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    const detail = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : undefined;
    return detail ? `eve: ${detail}` : `eve returned ${response.status}.`;
  } catch {
    return `eve returned ${response.status}.`;
  }
}
