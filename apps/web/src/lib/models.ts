import { z } from "zod";

export interface GatewayModel {
  id: string;
  label: string;
  provider: string;
  /** Tokens of context, when the catalog reports it. */
  contextWindow?: number;
  /** US dollars per million input and output tokens. */
  price?: { input: number; output: number };
  /** Reasoning efforts the model accepts, when it accepts any. */
  reasoning?: string[];
  tags: string[];
}

/**
 * Used only when the AI Gateway catalog cannot be reached. Every id here was
 * checked against https://ai-gateway.vercel.sh/v1/models; the first one is
 * Eve's own `eve init` default.
 */
const FALLBACK: GatewayModel[] = [
  { id: "openai/gpt-5.6-luna-fast", label: "GPT 5.6 Luna (Fast)", provider: "openai", tags: [] },
  { id: "openai/gpt-5.6-sol", label: "GPT 5.6 Sol", provider: "openai", tags: [] },
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic", tags: [] },
  { id: "anthropic/claude-opus-5", label: "Claude Opus 5", provider: "anthropic", tags: [] },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", provider: "google", tags: [] },
];

const catalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.string().optional(),
      context_window: z.number().optional(),
      tags: z.array(z.string()).optional(),
      pricing: z.object({ input: z.string().optional(), output: z.string().optional() }).passthrough().optional(),
      reasoning_options: z
        .array(z.object({ type: z.string(), values: z.array(z.string()).optional() }))
        .optional(),
    }),
  ),
});

function perMillion(value: string | undefined): number | undefined {
  const parsed = value === undefined ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 1_000_000 * 1000) / 1000 : undefined;
}

/**
 * Language models from the AI Gateway catalog. The catalog is public, so this
 * works without credentials; `AI_GATEWAY_API_KEY` is only needed to call a model.
 */
export async function listModels(): Promise<GatewayModel[]> {
  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return FALLBACK;
    const parsed = catalogSchema.safeParse(await response.json());
    if (!parsed.success) return FALLBACK;

    const models = parsed.data.data
      .filter((model) => model.type === undefined || model.type === "language")
      .map((model): GatewayModel => {
        const input = perMillion(model.pricing?.input);
        const output = perMillion(model.pricing?.output);
        const efforts = model.reasoning_options?.find((option) => option.type === "effort")?.values;
        return {
          id: model.id,
          label: model.name ?? model.id,
          provider: model.id.split("/")[0] ?? "unknown",
          contextWindow: model.context_window,
          price: input !== undefined && output !== undefined ? { input, output } : undefined,
          reasoning: efforts,
          tags: model.tags ?? [],
        };
      });
    return models.length > 0 ? models : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** Eve's default model for a new project. */
export const DEFAULT_MODEL_ID = FALLBACK[0]!.id;

/** "1M context · $2 / $10 per 1M tokens", or undefined when the catalog says nothing. */
export function describeModel(model: GatewayModel): string | undefined {
  const parts: string[] = [];
  if (model.contextWindow) {
    const window = model.contextWindow;
    parts.push(`${window >= 1_000_000 ? `${window / 1_000_000}M` : `${Math.round(window / 1000)}K`} context`);
  }
  if (model.price) parts.push(`$${model.price.input} in, $${model.price.output} out per 1M tokens`);
  return parts.length > 0 ? parts.join(", ") : undefined;
}
