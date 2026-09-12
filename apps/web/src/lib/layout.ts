import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { workspaceRoot } from "@/lib/workspace";

/**
 * Canvas node positions.
 *
 * Layout is EveLab's own presentation state, not Eve configuration, so it is
 * stored next to the workspace rather than inside the project. A project
 * directory stays pure Eve, and losing this file costs nothing but a re-layout.
 */

const layoutSchema = z.object({
  positions: z.record(z.object({ x: z.number().finite(), y: z.number().finite() })).default({}),
});

export type CanvasLayout = z.infer<typeof layoutSchema>;

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function layoutPath(projectId: string): string {
  if (!ID_PATTERN.test(projectId)) throw new Error(`Invalid project id: ${projectId}`);
  const path = resolve(join(workspaceRoot(), "..", "layouts", `${projectId}.json`));
  return path;
}

export async function readLayout(projectId: string): Promise<CanvasLayout> {
  try {
    const raw = await readFile(layoutPath(projectId), "utf8");
    const parsed = layoutSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { positions: {} };
  } catch {
    return { positions: {} };
  }
}

export async function writeLayout(projectId: string, layout: CanvasLayout): Promise<void> {
  const path = layoutPath(projectId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(layoutSchema.parse(layout), null, 2)}\n`, "utf8");
}
