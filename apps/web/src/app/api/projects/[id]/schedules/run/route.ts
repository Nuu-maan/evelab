import { z } from "zod";
import { guardProject, jsonError, readJson, upstreamError } from "@/lib/api";
import { sessionIdSchema, startRunRecord } from "@/lib/runs";
import { runtimeUrl } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ scheduleId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_\-/]*$/) });
const responseSchema = z.object({ sessionIds: z.array(sessionIdSchema) });

/**
 * Fires a schedule once through eve dev's dispatch route, the same path the
 * production cron handler takes, and records the sessions it starts.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await guardProject(id);
  if (denied) return denied;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return jsonError("Unknown schedule.", 400);
  const url = runtimeUrl(id);
  if (!url) return jsonError("Start the dev server on the Runs page first.", 409);

  const upstream = await fetch(`${url}/eve/v1/dev/schedules/${encodeURIComponent(body.data.scheduleId)}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!upstream.ok) return jsonError(await upstreamError(upstream), upstream.status === 404 ? 404 : 502);
  const parsed = responseSchema.safeParse(await upstream.json().catch(() => undefined));
  if (!parsed.success) return jsonError("eve did not return the sessions it started.", 502);

  for (const sessionId of parsed.data.sessionIds) {
    await startRunRecord(id, sessionId, `Schedule ${body.data.scheduleId}`, "eve dev schedule");
  }
  return Response.json({ sessionIds: parsed.data.sessionIds });
}
