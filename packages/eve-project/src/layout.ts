import type { AgentRoot } from "./types.js";

/**
 * Eve discovers an agent by walking fixed slots. The recommended layout keeps
 * them under `agent/`; the flat layout puts them at the package root. Both are
 * valid Eve projects, so EveLab detects which one it was given and writes back
 * to the same place.
 */

const ROOT_MARKERS = ["agent.ts", "instructions.md", "instructions.ts"];

export function detectAgentRoot(paths: readonly string[]): AgentRoot {
  const all = new Set(paths);
  if (ROOT_MARKERS.some((marker) => all.has(`agent/${marker}`))) return "agent";
  if (paths.some((path) => path.startsWith("agent/instructions/"))) return "agent";
  if (ROOT_MARKERS.some((marker) => all.has(marker))) return "";
  // A project with neither is new or empty; Eve recommends the nested layout.
  return "agent";
}

/** The repository path of a slot-relative path, e.g. `tools/x.ts` -> `agent/tools/x.ts`. */
export function agentPath(root: AgentRoot, relative: string): string {
  return root ? `${root}/${relative}` : relative;
}

/** True when a set of paths is recognisably an Eve project, in either layout. */
export function looksLikeEveProject(paths: readonly string[]): boolean {
  const all = new Set(paths);
  return (
    ROOT_MARKERS.some((marker) => all.has(`agent/${marker}`) || all.has(marker)) ||
    paths.some((path) => path.startsWith("agent/instructions/"))
  );
}
