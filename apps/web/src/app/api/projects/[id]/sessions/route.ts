import { z } from "zod";
import { guardProject, jsonError, readJson, upstreamError } from "@/lib/api";
import { sessionIdSchema, startRunRecord } from "@/lib/runs";
import { runtimeUrl } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ message: z.string().trim().min(1).max(20_000) });

/** Starts an eve session on the project's dev server and records it as a run. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await guardProject(id);
  if (denied) return denied;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return jsonError("Write a message.", 400);
  const url = runtimeUrl(id);
  if (!url) return jsonError("Start the dev server first.", 409);

  const upstream = await fetch(`${url}/eve/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: body.data.message }),
    cache: "no-store",
  });
  if (!upstream.ok) return jsonError(await upstreamError(upstream), 502);
  const payload = (await upstream.json().catch(() => ({}))) as { sessionId?: unknown };
  const sessionId = sessionIdSchema.safeParse(payload.sessionId ?? upstream.headers.get("x-eve-session-id"));
  if (!sessionId.success) return jsonError("eve did not return a session id.", 502);

  await startRunRecord(id, sessionId.data, body.data.message, "eve dev");
  return Response.json({ sessionId: sessionId.data }, { status: 201 });
}
