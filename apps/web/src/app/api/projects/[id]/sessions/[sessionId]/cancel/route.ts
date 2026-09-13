import { guardProject, jsonError, upstreamError } from "@/lib/api";
import { sessionIdSchema } from "@/lib/runs";
import { runtimeUrl } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/** Asks eve to cancel the active turn. The stream confirms with turn.cancelled. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  const denied = await guardProject(id);
  if (denied) return denied;
  if (!sessionIdSchema.safeParse(sessionId).success) return jsonError("Unknown session.", 404);
  const url = runtimeUrl(id);
  if (!url) return jsonError("The dev server is not running.", 409);

  const upstream = await fetch(`${url}/eve/v1/session/${sessionId}/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  if (!upstream.ok) return jsonError(await upstreamError(upstream), 502);
  return Response.json(await upstream.json().catch(() => ({ ok: true })));
}
