import { guardProject, jsonError } from "@/lib/api";
import type { EveEvent } from "@/lib/run-timeline";
import { appendRunEvents, getRun, readRunEvents, sessionIdSchema } from "@/lib/runs";
import { runtimeUrl } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const HEADERS = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" };

function replay(events: EveEvent[]): Response {
  return new Response(events.map((event) => `${JSON.stringify(event)}\n`).join(""), {
    headers: { ...HEADERS, "x-evelab-live": "false" },
  });
}

/**
 * Proxies eve's NDJSON session stream to the browser and records every event
 * on the way through. When the dev server is gone, the recorded stream is
 * served instead, so a finished run can still be inspected.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  const denied = await guardProject(id);
  if (denied) return denied;
  if (!sessionIdSchema.safeParse(sessionId).success || !(await getRun(id, sessionId))) {
    return jsonError("Unknown session.", 404);
  }
  const startIndex = Math.max(0, Number(new URL(request.url).searchParams.get("startIndex") ?? 0) || 0);

  const url = runtimeUrl(id);
  const stored = () => readRunEvents(id, sessionId).then((events) => replay(events.slice(startIndex)));
  if (!url) return stored();

  let upstream: Response;
  try {
    upstream = await fetch(`${url}/eve/v1/session/${sessionId}/stream?startIndex=${startIndex}`, {
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return stored();
  }
  if (!upstream.ok || !upstream.body) return stored();

  const decoder = new TextDecoder();
  let buffer = "";
  const record = (lines: string[]) => {
    const events = lines.flatMap((line) => {
      try {
        return line.trim() ? [JSON.parse(line) as EveEvent] : [];
      } catch {
        return [];
      }
    });
    void appendRunEvents(id, sessionId, events).catch(() => undefined);
  };

  const tee = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      record(lines);
    },
    flush() {
      record([buffer]);
    },
  });

  return new Response(upstream.body.pipeThrough(tee), { headers: { ...HEADERS, "x-evelab-live": "true" } });
}
