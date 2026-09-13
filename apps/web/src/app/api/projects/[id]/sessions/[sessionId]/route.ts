import { z } from "zod";
import { guardProject, jsonError, readJson, upstreamError } from "@/lib/api";
import { sessionIdSchema } from "@/lib/runs";
import { runtimeUrl } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const bodySchema = z.union([
  z.object({ message: z.string().trim().min(1).max(20_000) }).strict(),
  z
    .object({
      inputResponses: z
        .array(
          z
            .object({
              requestId: z.string().min(1).max(200),
              optionId: z.string().min(1).max(200).optional(),
              text: z.string().max(20_000).optional(),
            })
            .strict(),
        )
        .min(1)
        .max(20),
    })
    .strict(),
]);

/** A follow-up message, or answers to pending approvals and questions. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  const denied = await guardProject(id);
  if (denied) return denied;
  if (!sessionIdSchema.safeParse(sessionId).success) return jsonError("Unknown session.", 404);
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return jsonError("Send a message or input responses.", 400);
  const url = runtimeUrl(id);
  if (!url) return jsonError("The dev server is not running, so this run cannot continue.", 409);

  const upstream = await fetch(`${url}/eve/v1/session/${sessionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body.data),
    cache: "no-store",
  });
  if (!upstream.ok) return jsonError(await upstreamError(upstream), upstream.status === 409 ? 409 : 502);
  return Response.json({ ok: true });
}
