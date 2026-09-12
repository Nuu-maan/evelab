import {
  patchAgentSource,
  readAgentSource,
  readModelValue,
  readStringValue,
  renderModelValue,
} from "./agent-source.js";
import { stringifyFrontmatter, type Frontmatter } from "./frontmatter.js";
import { isGeneratedPath, type EveProject, type ProjectFile, type Subagent } from "./types.js";

/**
 * Writes the project model back to real Eve files.
 *
 * Files EveLab does not own (package.json, helpers, tests, anything outside the
 * generated paths) are passed through byte for byte.
 */
export function generateProject(project: EveProject): ProjectFile[] {
  const original = new Map(project.files.map((file) => [file.path, file.content]));
  const output = new Map<string, string>();

  for (const file of project.files) {
    if (!isGeneratedPath(file.path)) output.set(file.path, file.content);
  }

  output.set("agent.ts", renderAgentSource(project, original.get("agent.ts")));
  output.set(project.agent.instructionsPath, project.agent.instructions);

  for (const tool of project.tools) {
    output.set(`tools/${tool.id}.ts`, tool.source);
  }

  for (const skill of project.skills) {
    output.set(`skills/${skill.id}/SKILL.md`, skill.markdown);
    for (const file of skill.files) {
      output.set(`skills/${skill.id}/${file.path}`, file.content);
    }
  }

  for (const subagent of project.subagents) {
    output.set(`subagents/${subagent.id}.md`, renderSubagent(subagent));
  }

  return [...output.entries()]
    .map(([path, content]) => ({ path, content }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Patches an existing `agent.ts` in place; only falls back to a template when
 * the project has no agent module yet (a project created inside EveLab).
 */
function renderAgentSource(project: EveProject, existing: string | undefined): string {
  const { agent } = project;
  const patch: Record<string, string> = {
    name: JSON.stringify(agent.name),
    model: renderModelValue(agent.model),
  };
  if (agent.description !== undefined) {
    patch.description = JSON.stringify(agent.description);
  }

  if (existing) {
    try {
      return patchAgentSource(existing, withoutUnchanged(existing, agent, patch));
    } catch {
      // Unparseable source is the user's source of truth; never clobber it.
      return existing;
    }
  }
  return renderAgentTemplate(project);
}

/**
 * Drops edits whose value is already what the source says, so an untouched
 * field keeps its original formatting instead of being normalised.
 */
function withoutUnchanged(
  source: string,
  agent: EveProject["agent"],
  patch: Record<string, string>,
): Record<string, string> {
  const config = readAgentSource(source);
  if (!config) return patch;

  const result: Record<string, string> = {};
  for (const [key, text] of Object.entries(patch)) {
    const current = config.properties.get(key)?.text;
    if (current === undefined) {
      result[key] = text;
      continue;
    }
    if (key === "model") {
      const parsed = readModelValue(current);
      if (parsed && sameModel(parsed, agent.model)) continue;
    } else if (readStringValue(current) === JSON.parse(text)) {
      continue;
    }
    result[key] = text;
  }
  return result;
}

function sameModel(a: EveProject["agent"]["model"], b: EveProject["agent"]["model"]): boolean {
  return (
    a.id === b.id &&
    a.temperature === b.temperature &&
    a.maxOutputTokens === b.maxOutputTokens &&
    JSON.stringify(a.raw) === JSON.stringify(b.raw)
  );
}

/**
 * Template for projects EveLab creates from scratch.
 *
 * TODO: validate the import path, factory name and option names against the
 * current Eve docs before enabling project creation in production. Everything
 * else in this package works off the user's own source and does not depend on
 * these names being right.
 */
export function renderAgentTemplate(project: EveProject): string {
  const { agent } = project;
  const lines = [
    `import { Agent } from "eve";`,
    ``,
    `export default new Agent({`,
    `  name: ${JSON.stringify(agent.name)},`,
  ];
  if (agent.description) lines.push(`  description: ${JSON.stringify(agent.description)},`);
  lines.push(`  model: ${renderModelValue(agent.model)},`);
  lines.push(`  instructions: ${JSON.stringify(agent.instructionsPath)},`);
  for (const [key, value] of Object.entries(agent.raw)) {
    lines.push(`  ${key}: ${value},`);
  }
  lines.push(`});`, ``);
  return lines.join("\n");
}

function renderSubagent(subagent: Subagent): string {
  const data: Frontmatter = { name: subagent.name };
  if (subagent.description) data.description = subagent.description;
  if (subagent.model) data.model = subagent.model.id;
  if (subagent.tools.length > 0) data.tools = subagent.tools;
  if (subagent.skills.length > 0) data.skills = subagent.skills;
  for (const [key, value] of Object.entries(subagent.raw)) data[key] = value;
  return stringifyFrontmatter(data, subagent.instructions);
}
