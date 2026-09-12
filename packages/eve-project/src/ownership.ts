import type { EveProject, Subagent } from "./types.js";

/**
 * Who can use a tool or skill, as the canvas draws it.
 *
 * Ownership is stored in subagent frontmatter (`tools`, `skills`). A capability
 * no subagent lists belongs to the main agent, so "the agent owns it" is the
 * absence of any subagent claim rather than a separate record. That is also why
 * moving a capability to the agent clears every subagent's claim on it.
 */

export class OwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipError";
  }
}

export interface CapabilityLink {
  /** Canvas node id of the owner: "agent" or "subagent:<id>". */
  owner: string;
  /** Canvas node id of the capability: "tool:<id>" or "skill:<id>". */
  capability: string;
}

export interface OwnershipChange {
  remove?: CapabilityLink;
  add?: CapabilityLink;
}

function splitRef(ref: string): [string, string] {
  const separator = ref.indexOf(":");
  return separator === -1 ? [ref, ""] : [ref.slice(0, separator), ref.slice(separator + 1)];
}

function resolveOwner(project: EveProject, ref: string): Subagent | "agent" {
  if (ref === "agent") return "agent";
  const [kind, id] = splitRef(ref);
  const subagent = kind === "subagent" ? project.subagents.find((entry) => entry.id === id) : undefined;
  if (!subagent) throw new OwnershipError(`There is no subagent "${id || ref}" in this project.`);
  return subagent;
}

function resolveCapability(project: EveProject, ref: string): { list: "tools" | "skills"; id: string } {
  const [kind, id] = splitRef(ref);
  if (kind === "tool" && project.tools.some((tool) => tool.id === id)) return { list: "tools", id };
  if (kind === "skill" && project.skills.some((skill) => skill.id === id)) return { list: "skills", id };
  throw new OwnershipError(`There is no ${kind === "skill" ? "skill" : "tool"} "${id || ref}" in this project.`);
}

/** Returns a new project with the change applied. The input is never mutated. */
export function applyOwnershipChange(project: EveProject, change: OwnershipChange): EveProject {
  const next = structuredClone(project);

  // Resolve everything first, so a bad reference fails before anything moves.
  const remove = change.remove && {
    owner: resolveOwner(next, change.remove.owner),
    ...resolveCapability(next, change.remove.capability),
  };
  const add = change.add && {
    owner: resolveOwner(next, change.add.owner),
    ...resolveCapability(next, change.add.capability),
  };

  if (remove && remove.owner !== "agent") {
    remove.owner[remove.list] = remove.owner[remove.list].filter((entry) => entry !== remove.id);
  }

  if (add) {
    if (add.owner === "agent") {
      for (const subagent of next.subagents) {
        subagent[add.list] = subagent[add.list].filter((entry) => entry !== add.id);
      }
    } else if (!add.owner[add.list].includes(add.id)) {
      add.owner[add.list] = [...add.owner[add.list], add.id];
    }
  }

  return next;
}
