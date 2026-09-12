import "server-only";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { PANES, paneCookie, type PaneName } from "@/lib/pane-config";

const widthSchema = z.coerce.number().int().positive();

/**
 * Pane widths as CSS custom properties.
 *
 * Widths persist in cookies so the server renders the user's layout and nothing
 * jumps on hydration. The cookie is client-written, so it is parsed and clamped.
 */
export async function paneStyle(): Promise<CSSProperties> {
  const jar = await cookies();
  const style: Record<string, string> = {};
  for (const name of Object.keys(PANES) as PaneName[]) {
    const bounds = PANES[name];
    const parsed = widthSchema.safeParse(jar.get(paneCookie(name))?.value);
    const width = parsed.success
      ? Math.min(bounds.max, Math.max(bounds.min, parsed.data))
      : bounds.initial;
    style[`--pane-${name}`] = `${width}px`;
  }
  return style as CSSProperties;
}
