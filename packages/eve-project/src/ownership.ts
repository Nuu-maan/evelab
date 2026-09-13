import { hasRelativeImports } from "./agent-source.js";
import type { Connection, EveProject, Skill, Subagent, Tool } from "./types.js";

/**
 * Who can use a tool, skill or connection, as the canvas draws it.
 *
 * In Eve a declared subagent inherits nothing from its parent: it has only what
 * lives in its own `subagents/<id>/` directory. So handing a capability to a
 * subagent means moving its file there, and handing it back moves it to the
 * parent's slot. Nothing else is written.
 */

export class OwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipError";
  }
}

export interface OwnershipMove {
  /** Canvas id of the capability: "tool:search_docs", "skill:researcher/cite". */
  capability: string;
  /** Canvas id of the new owner: "agent" or "subagent:researcher". */
  to: string;
}

type CapabilityKind = "tool" | "skill" | "connection";

interface CapabilityOwner {
  tools: Tool[];
  skills: Skill[];
  connections: Connection[];
  subagents: Subagent[];
}

export function parseCapabilityRef(ref: string): { kind: CapabilityKind; ownerKey: string; id: string } | undefined {
  const match = /^(tool|skill|connection):(?:(.+)\/)?([^/]+)$/.exec(ref);
  if (!match) return undefined;
  return { kind: match[1] as CapabilityKind, ownerKey: match[2] ?? "", id: match[3]! };
}

function ownerKeyOf(ref: string): string | undefined {
  if (ref === "agent") return "";
  return ref.startsWith("subagent:") ? ref.slice("subagent:".length) : undefined;
}

function findOwner(root: CapabilityOwner, key: string): CapabilityOwner | undefined {
  if (key === "") return root;
  let current: CapabilityOwner = root;
  for (const part of key.split("/")) {
    const next = current.subagents.find((subagent) => subagent.id === part && subagent.kind === "local");
    if (!next) return undefined;
    current = next;
  }
  return current;
}

function ownerName(key: string): string {
  return key ? `Subagent "${key}"` : "The agent";
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id.localeCompare(b.id);
}

/** Returns a new project with the capability moved. The input is never mutated. */
export function applyOwnershipChange(project: EveProject, move: OwnershipMove): EveProject {
  const next = structuredClone(project);
  const capability = parseCapabilityRef(move.capability);
  if (!capability) throw new OwnershipError(`"${move.capability}" is not a tool, skill or connection.`);
  const toKey = ownerKeyOf(move.to);
  if (toKey === undefined) throw new OwnershipError(`"${move.to}" cannot own tools, skills or connections.`);

  const from = findOwner(next, capability.ownerKey);
  if (!from) throw new OwnershipError(`There is no subagent "${capability.ownerKey}" in this project.`);
  const to = findOwner(next, toKey);
  if (!to) throw new OwnershipError(`There is no local subagent "${toKey}" in this project.`);

  const { kind, id } = capability;
  const taken = (entries: Array<{ id: string }>) => entries.some((entry) => entry.id === id);

  switch (kind) {
    case "tool": {
      const tool = from.tools.find((entry) => entry.id === id);
      if (!tool) throw new OwnershipError(`There is no tool "${id}" there.`);
      if (from === to) return next;
      if (taken(to.tools)) throw new OwnershipError(`${ownerName(toKey)} already has a tool named "${id}".`);
      if (taken(to.subagents)) throw new OwnershipError(`${ownerName(toKey)} has a subagent named "${id}", and Eve rejects that collision.`);
      refuseRelativeImports(id, [tool.source]);
      from.tools = from.tools.filter((entry) => entry !== tool);
      to.tools = [...to.tools, tool].sort(byId);
      return next;
    }
    case "skill": {
      const skill = from.skills.find((entry) => entry.id === id);
      if (!skill) throw new OwnershipError(`There is no skill "${id}" there.`);
      if (from === to) return next;
      if (taken(to.skills)) throw new OwnershipError(`${ownerName(toKey)} already has a skill named "${id}".`);
      if (skill.format === "module") refuseRelativeImports(id, [skill.content]);
      from.skills = from.skills.filter((entry) => entry !== skill);
      to.skills = [...to.skills, skill].sort(byId);
      return next;
    }
    case "connection": {
      const connection = from.connections.find((entry) => entry.id === id);
      if (!connection) throw new OwnershipError(`There is no connection "${id}" there.`);
      if (from === to) return next;
      if (taken(to.connections)) throw new OwnershipError(`${ownerName(toKey)} already has a connection named "${id}".`);
      refuseRelativeImports(id, [connection.source]);
      from.connections = from.connections.filter((entry) => entry !== connection);
      to.connections = [...to.connections, connection].sort(byId);
      return next;
    }
  }
}

/**
 * Returns a new project without a tool, skill, connection or subagent, given
 * its canvas id. Generation then drops exactly that entity's files.
 */
export function removeEntity(project: EveProject, ref: string): EveProject {
  const next = structuredClone(project);
  if (ref.startsWith("subagent:")) {
    const key = ref.slice("subagent:".length);
    const parts = key.split("/");
    const id = parts.pop()!;
    const owner = findOwner(next, parts.join("/"));
    if (!owner || !owner.subagents.some((subagent) => subagent.id === id)) {
      throw new OwnershipError(`There is no subagent "${key}" in this project.`);
    }
    owner.subagents = owner.subagents.filter((subagent) => subagent.id !== id);
    return next;
  }

  const capability = parseCapabilityRef(ref);
  if (!capability) throw new OwnershipError(`"${ref}" is not something that can be removed.`);
  const owner = findOwner(next, capability.ownerKey);
  if (!owner) throw new OwnershipError(`There is no subagent "${capability.ownerKey}" in this project.`);
  const { kind, id } = capability;
  const list = kind === "tool" ? owner.tools : kind === "skill" ? owner.skills : owner.connections;
  if (!list.some((entry) => entry.id === id)) throw new OwnershipError(`There is no ${kind} "${id}" there.`);
  if (kind === "tool") owner.tools = owner.tools.filter((entry) => entry.id !== id);
  if (kind === "skill") owner.skills = owner.skills.filter((entry) => entry.id !== id);
  if (kind === "connection") owner.connections = owner.connections.filter((entry) => entry.id !== id);
  return next;
}

function refuseRelativeImports(id: string, sources: string[]): void {
  if (sources.some(hasRelativeImports)) {
    throw new OwnershipError(
      `${id} imports other files by relative path, so moving it would break those imports. Move it in the source instead.`,
    );
  }
}
