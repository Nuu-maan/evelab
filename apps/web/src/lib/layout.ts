import "server-only";
import { z } from "zod";
import { annotationSchema, LAYOUT_MODES } from "@/components/canvas/layout";
import { stateStore } from "@/lib/state-store";

/**
 * Canvas node positions.
 *
 * Layout is EveLab's own presentation state, not Eve configuration, so it is
 * stored next to the workspace rather than inside the project. A project
 * directory stays pure Eve, and losing this file costs nothing but a re-layout.
 */

const layoutSchema = z.object({
  positions: z.record(z.object({ x: z.number().finite(), y: z.number().finite() })).default({}),
  mode: z.enum(LAYOUT_MODES).default("hierarchical"),
  /** Agents whose subagents and resources are folded away. */
  collapsed: z.array(z.string()).default([]),
  annotations: z.array(annotationSchema).default([]),
});

const EMPTY: CanvasLayout = { positions: {}, mode: "hierarchical", collapsed: [], annotations: [] };

export type CanvasLayout = z.infer<typeof layoutSchema>;

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function layoutKey(projectId: string): string {
  if (!ID_PATTERN.test(projectId)) throw new Error(`Invalid project id: ${projectId}`);
  return `layouts/${projectId}.json`;
}

export async function readLayout(projectId: string): Promise<CanvasLayout> {
  try {
    const raw = await stateStore().read(layoutKey(projectId));
    if (raw === undefined) return EMPTY;
    const parsed = layoutSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function writeLayout(projectId: string, layout: z.input<typeof layoutSchema>): Promise<void> {
  await stateStore().write(layoutKey(projectId), `${JSON.stringify(layoutSchema.parse(layout), null, 2)}\n`);
}
