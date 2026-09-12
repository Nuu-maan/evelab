import ts from "typescript";
import { parseFrontmatter } from "./frontmatter.js";
import { readAgentSource, readModelValue, readStringValue } from "./agent-source.js";
import {
  eveProjectSchema,
  type EveProject,
  type ProjectFile,
  type Skill,
  type Subagent,
  type Tool,
} from "./types.js";

const KNOWN_AGENT_KEYS = new Set(["name", "description", "model", "instructions"]);

export interface ParseWarning {
  path: string;
  message: string;
}

export interface ParseResult {
  project: EveProject;
  warnings: ParseWarning[];
}

function byPath(files: ProjectFile[]): Map<string, string> {
  return new Map(files.map((file) => [file.path, file.content]));
}

/** Turns the files of a real Eve project into the EveLab project model. */
export function parseProject(files: ProjectFile[]): ParseResult {
  const warnings: ParseWarning[] = [];
  const contents = byPath(files);

  const agentSource = contents.get("agent.ts");
  const config = agentSource ? readAgentSource(agentSource) : undefined;
  if (agentSource && !config) {
    warnings.push({
      path: "agent.ts",
      message: "No exported agent config object found; agent settings are read-only in the GUI.",
    });
  }

  const raw: Record<string, string> = {};
  for (const [name, property] of config?.properties ?? []) {
    if (!KNOWN_AGENT_KEYS.has(name)) raw[name] = property.text;
  }

  const nameText = config?.properties.get("name")?.text;
  const descriptionText = config?.properties.get("description")?.text;
  const modelText = config?.properties.get("model")?.text;
  const instructionsText = config?.properties.get("instructions")?.text;

  const model = modelText ? readModelValue(modelText) : undefined;
  if (modelText && !model) {
    warnings.push({
      path: "agent.ts",
      message: "`model` is computed in code; edit it in the source editor.",
    });
    raw.model = modelText;
  }

  const instructionsPath = resolveInstructionsPath(instructionsText, contents);

  const project: EveProject = eveProjectSchema.parse({
    agent: {
      name: (nameText && readStringValue(nameText)) || "Untitled agent",
      description: descriptionText ? readStringValue(descriptionText) : undefined,
      model: model ?? { id: "", raw: {} },
      instructionsPath,
      instructions: contents.get(instructionsPath) ?? "",
      raw,
    },
    tools: parseTools(files, warnings),
    skills: parseSkills(files),
    subagents: parseSubagents(files),
    files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
  });

  return { project, warnings };
}

/**
 * Eve projects reference instructions either by path or inline. Only the path
 * form is editable as markdown, so an inline value keeps the default path and
 * leaves the literal text in `agent.raw`.
 */
function resolveInstructionsPath(
  instructionsText: string | undefined,
  contents: Map<string, string>,
): string {
  const value = instructionsText ? readStringValue(instructionsText) : undefined;
  if (value && value.endsWith(".md") && contents.has(value)) return value;
  return "instructions.md";
}

function parseTools(files: ProjectFile[], warnings: ParseWarning[]): Tool[] {
  return files
    .filter((file) => file.path.startsWith("tools/") && file.path.endsWith(".ts"))
    .filter((file) => !file.path.endsWith(".test.ts"))
    .map((file) => {
      const id = file.path.slice("tools/".length, -".ts".length);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
        warnings.push({ path: file.path, message: "Tool file name is not a kebab-case id." });
      }
      const metadata = readToolMetadata(file.content);
      return {
        id,
        name: metadata.name ?? id,
        description: metadata.description ?? "",
        origin: file.content.includes("mcp") ? ("mcp" as const) : ("custom" as const),
        enabled: true,
        source: file.content,
      };
    })
    .filter((tool) => /^[a-z0-9][a-z0-9-]*$/.test(tool.id));
}

/** Pulls `name`/`description` out of the first object literal in a tool module. */
function readToolMetadata(source: string): { name?: string; description?: string } {
  const file = ts.createSourceFile("tool.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let result: { name?: string; description?: string } = {};

  const visit = (node: ts.Node): void => {
    if (result.description !== undefined) return;
    if (ts.isObjectLiteralExpression(node)) {
      const found: { name?: string; description?: string } = {};
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue;
        const key = property.name.text;
        if (key !== "name" && key !== "description") continue;
        const initializer = property.initializer;
        if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
          found[key] = initializer.text;
        }
      }
      if (found.name || found.description) {
        result = found;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(file, visit);
  return result;
}

function parseSkills(files: ProjectFile[]): Skill[] {
  const skills = new Map<string, Skill>();

  for (const file of files) {
    if (!file.path.startsWith("skills/")) continue;
    const rest = file.path.slice("skills/".length);
    const separator = rest.indexOf("/");
    if (separator === -1) continue;
    const id = rest.slice(0, separator);
    const relative = rest.slice(separator + 1);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) continue;

    const skill = skills.get(id) ?? {
      id,
      name: id,
      description: "",
      markdown: "",
      files: [],
      source: undefined,
    };

    if (relative === "SKILL.md") {
      const { data } = parseFrontmatter(file.content);
      skill.markdown = file.content;
      skill.name = typeof data.name === "string" ? data.name : id;
      skill.description = typeof data.description === "string" ? data.description : "";
      if (typeof data.source === "string") skill.source = data.source;
    } else {
      skill.files.push({ path: relative, content: file.content });
    }

    skills.set(id, skill);
  }

  return [...skills.values()].sort((a, b) => a.id.localeCompare(b.id));
}

const SUBAGENT_KEYS = new Set(["name", "description", "model", "tools", "skills"]);

function parseSubagents(files: ProjectFile[]): Subagent[] {
  return files
    .filter((file) => file.path.startsWith("subagents/") && file.path.endsWith(".md"))
    .map((file) => {
      const id = file.path.slice("subagents/".length, -".md".length);
      const { data, body } = parseFrontmatter(file.content);
      const raw: Record<string, string | string[]> = {};
      for (const [key, value] of Object.entries(data)) {
        if (!SUBAGENT_KEYS.has(key)) raw[key] = value;
      }
      return {
        id,
        name: typeof data.name === "string" ? data.name : id,
        description: typeof data.description === "string" ? data.description : "",
        model: typeof data.model === "string" ? { id: data.model, raw: {} } : undefined,
        instructions: body,
        tools: toList(data.tools),
        skills: toList(data.skills),
        raw,
      };
    })
    .filter((subagent) => /^[a-z0-9][a-z0-9-]*$/.test(subagent.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function toList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}
