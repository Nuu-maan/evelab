import { z } from "zod";

export interface GatewayModel {
  id: string;
  label: string;
  provider: string;
}

/**
 * Fallback catalogue used when no AI Gateway credentials are configured.
 *
 * TODO: replace with live discovery against the configured gateway
 * (`AI_GATEWAY_API_KEY`) so the list cannot drift. The model id is written to
 * `agent.ts` verbatim, so anything the gateway accepts can also be typed by hand
 * on the Model tab.
 */
const FALLBACK: GatewayModel[] = [
  { id: "openai/gpt-5.6", label: "GPT-5.6", provider: "OpenAI" },
  { id: "anthropic/claude-opus-5", label: "Claude Opus 5", provider: "Anthropic" },
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5", provider: "Anthropic" },
  { id: "google/gemini-3-pro", label: "Gemini 3 Pro", provider: "Google" },
];

const gatewayResponseSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string().optional() })),
});

export async function listModels(): Promise<GatewayModel[]> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return FALLBACK;

  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return FALLBACK;
    const parsed = gatewayResponseSchema.safeParse(await response.json());
    if (!parsed.success) return FALLBACK;

    return parsed.data.data.map((model) => ({
      id: model.id,
      label: model.name ?? model.id,
      provider: model.id.split("/")[0] ?? "Unknown",
    }));
  } catch {
    return FALLBACK;
  }
}
