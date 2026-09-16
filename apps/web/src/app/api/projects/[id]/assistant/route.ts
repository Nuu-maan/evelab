import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { guardProject, jsonError, readJson } from "@/lib/api";
import { assistantAvailable, createAssistant } from "@/lib/assistant";

export const dynamic = "force-dynamic";
// A build request can take several tool steps; Vercel Functions allow it to stream this long.
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await guardProject(id);
  if (denied) return denied;
  if (!assistantAvailable()) {
    return jsonError("The assistant calls models through AI Gateway. Set AI_GATEWAY_API_KEY on the evelab server.", 503);
  }
  const body = (await readJson(request)) as { messages?: UIMessage[] } | undefined;
  if (!body || !Array.isArray(body.messages)) return jsonError("Send the conversation.", 400);

  return createAgentUIStreamResponse({
    agent: createAssistant(id),
    uiMessages: body.messages,
  });
}
