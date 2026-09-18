import type { Connection, EveProject } from "@evelab/eve-project";

type Subagents = EveProject["subagents"];

/**
 * Every connection in a project, the way the Connections page lists them: shared
 * definitions in lib/ once each, plus each agent's own, nested subagents included.
 * The sidebar count reads the same list, so the two never disagree.
 */
export function projectConnections(project: EveProject) {
  // Keyed by the folder the owning agent lives in; the root agent is "".
  const walk = (subagents: Subagents, prefix: string): { connection: Connection; owner: string }[] =>
    subagents.flatMap((subagent) =>
      subagent.kind === "local"
        ? [
            ...subagent.connections.map((connection) => ({ connection, owner: `${prefix}${subagent.id}` })),
            ...walk(subagent.subagents, `${prefix}${subagent.id}/`),
          ]
        : [],
    );
  const all = [...project.connections.map((connection) => ({ connection, owner: "" })), ...walk(project.subagents, "")];
  const owned = all.filter(({ connection }) => !connection.shared);
  const shared = project.library.connections.map((definition) => ({
    definition,
    users: all
      .filter(({ connection }) => connection.shared === definition.id)
      .map(({ owner }) => owner.split("/").pop() || project.agent.name),
  }));
  return { all, owned, shared };
}
