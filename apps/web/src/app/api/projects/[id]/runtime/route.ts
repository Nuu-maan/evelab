import { z } from "zod";
import { guardProject, jsonError, readJson } from "@/lib/api";
import { getRuntime, runtimeAvailable, startRuntime, stopRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const denied = await guardProject(id);
  if (denied) return denied;
  return Response.json({ runtime: getRuntime(id), allowed: runtimeAvailable() });
}

const bodySchema = z.object({ action: z.enum(["start", "stop"]) });

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const denied = await guardProject(id);
  if (denied) return denied;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return jsonError("Send start or stop.", 400);
  const runtime = body.data.action === "start" ? await startRuntime(id) : stopRuntime(id);
  return Response.json({ runtime, allowed: runtimeAvailable() });
}
