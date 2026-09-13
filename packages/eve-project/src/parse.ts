import { parseFrontmatter } from "./frontmatter.js";
import {
  readAgentSource,
  readConnectorValue,
  readDefinitionCallee,
  readFilterValue,
  readImports,
  readStringProperty,
  readStringValue,
} from "./agent-source.js";
import { detectAgentRoot } from "./layout.js";
import {
  eveProjectSchema,
  reasoningSchema,
  scheduleIdSchema,
  slugSchema,
  type Channel,
  type ChannelKind,
  type Connection,
  type ConnectionAuth,
  type ConnectionKind,
  type EveProject,
  type ModelConfig,
  type ProjectFile,
  type Reasoning,
  type Schedule,
  type Skill,
  type Subagent,
  type Tool,
  type ToolKind,
} from "./types.js";

export interface ParseWarning {
  path: string;
  message: string;
}

export interface ParseResult {
  project: EveProject;
  warnings: ParseWarning[];
}

export interface ParseOptions {
  /** The agent name when package.json has none, usually the project directory name. */
  fallbackName?: string;
}

const MODULE = /\.(?:ts|mts|js|mjs)$/;
const NOT_A_DEFINITION = /\.(?:test|spec|d)\.(?:ts|mts|js|mjs)$/;

interface Context {
  contents: Map<string, string>;
  paths: string[];
  claimed: Set<string>;
  warnings: ParseWarning[];
}

interface Settings {
  model?: ModelConfig;
  reasoning?: Reasoning;
  description?: string;
  raw: Record<string, string>;
}

/** Turns the files of a real Eve project into the EveLab project model. */
export function parseProject(files: ProjectFile[], options: ParseOptions = {}): ParseResult {
  const contents = new Map(files.map((file) => [file.path, file.content]));
  const paths = [...contents.keys()];
  const context: Context = { contents, paths, claimed: new Set(), warnings: [] };

  const root = detectAgentRoot(paths);
  const base = root ? `${root}/` : "";

  const configPath = `${base}agent.ts`;
  const configSource = contents.get(configPath);
  if (configSource !== undefined) context.claimed.add(configPath);
  const settings = readSettings(configSource, configPath, context.warnings);

  const instructionsPath = `${base}instructions.md`;
  const instructions = contents.get(instructionsPath);
  if (instructions !== undefined) context.claimed.add(instructionsPath);

  const project = eveProjectSchema.parse({
    root,
    agent: {
      name: packageName(contents) ?? options.fallbackName ?? "agent",
      hasConfig: configSource !== undefined,
      ...settings,
      source: configSource ?? "",
      instructions: instructions ?? "",
      instructionSources: paths
        .filter((path) => path === `${base}instructions.ts` || path.startsWith(`${base}instructions/`))
        .sort(),
    },
    tools: readTools(context, base),
    skills: readSkills(context, base),
    subagents: readSubagents(context, base),
    connections: readConnections(context, base),
    channels: readChannels(context, base),
    schedules: readSchedules(context, base),
    files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
    generatedPaths: [...context.claimed].sort(),
  });

  return { project, warnings: context.warnings };
}

function packageName(contents: Map<string, string>): string | undefined {
  const text = contents.get("package.json");
  if (!text) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    const name = typeof parsed === "object" && parsed !== null ? (parsed as { name?: unknown }).name : undefined;
    return typeof name === "string" && name.trim() ? name : undefined;
  } catch {
    return undefined;
  }
}

function readSettings(source: string | undefined, path: string, warnings: ParseWarning[]): Settings {
  if (source === undefined) return { raw: {} };
  const config = readAgentSource(source);
  if (!config) {
    warnings.push({ path, message: "No defineAgent config object was found, so its settings are read-only here." });
    return { raw: {} };
  }

  const settings: Settings = { raw: {} };
  for (const [name, property] of config.properties) {
    const literal = readStringValue(property.text);
    if (name === "model") {
      settings.model = literal !== undefined ? { id: literal } : { id: "", expression: property.text };
    } else if (name === "reasoning" && literal !== undefined && reasoningSchema.safeParse(literal).success) {
      settings.reasoning = literal as Reasoning;
    } else if (name === "description" && literal !== undefined) {
      settings.description = literal;
    } else {
      settings.raw[name] = property.text;
    }
  }
  return settings;
}

/** Direct files of a directory, and the names of its subdirectories. */
function listDirectory(paths: string[], dir: string): { files: string[]; dirs: string[] } {
  const files: string[] = [];
  const dirs = new Set<string>();
  for (const path of paths) {
    if (!path.startsWith(dir)) continue;
    const rest = path.slice(dir.length);
    const slash = rest.indexOf("/");
    if (slash === -1) files.push(path);
    else dirs.add(rest.slice(0, slash));
  }
  return { files: files.sort(), dirs: [...dirs].sort() };
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function stem(path: string): string {
  return fileName(path).replace(/\.[^.]+$/, "");
}

function isDefinitionModule(path: string): boolean {
  return MODULE.test(path) && !NOT_A_DEFINITION.test(path);
}

function isSlug(value: string): boolean {
  return slugSchema.safeParse(value).success;
}

const PROVIDED_TOOL_MODULE = /^eve\/tools\/(?!approval$)[a-z_]+$/;

function toolKind(source: string): ToolKind {
  switch (readDefinitionCallee(source)) {
    case "defineTool":
      return "tool";
    case "defineWorkflowTool":
      return "workflow";
    case "disableTool":
      return "disabled";
    case "defineDynamic":
      return "dynamic";
    default:
      return readImports(source).some((specifier) => PROVIDED_TOOL_MODULE.test(specifier)) ? "provided" : "other";
  }
}

function readTools(context: Context, base: string): Tool[] {
  const tools: Tool[] = [];
  for (const path of listDirectory(context.paths, `${base}tools/`).files) {
    if (!isDefinitionModule(path)) continue;
    const id = stem(path);
    if (!isSlug(id)) {
      context.warnings.push({ path, message: "Tool file names use letters, digits, - and _; this file is left as is." });
      continue;
    }
    const source = context.contents.get(path) ?? "";
    context.claimed.add(path);
    tools.push({ id, file: fileName(path), description: readStringProperty(source, "description") ?? "", kind: toolKind(source), source });
  }
  return tools;
}

/**
 * A flat markdown skill without `description` frontmatter advertises its first
 * non-empty, non-fence body line with any leading `#`, `>`, `*` or `-` removed.
 */
export function markdownSkillDescription(markdown: string): string {
  const { data, body } = parseFrontmatter(markdown);
  if (typeof data.description === "string" && data.description) return data.description;
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("```")) continue;
    return trimmed.replace(/^[#>*-]+\s*/, "");
  }
  return "";
}

function readSkills(context: Context, base: string): Skill[] {
  const dir = `${base}skills/`;
  const { files, dirs } = listDirectory(context.paths, dir);
  const skills: Skill[] = [];

  for (const path of files) {
    const id = stem(path);
    const content = context.contents.get(path) ?? "";
    const format = path.endsWith(".md") ? "markdown" : isDefinitionModule(path) ? "module" : undefined;
    if (!format) continue;
    if (!isSlug(id)) {
      context.warnings.push({ path, message: "Skill names use letters, digits, - and _; this file is left as is." });
      continue;
    }
    context.claimed.add(path);
    skills.push({
      id,
      format,
      description: format === "markdown" ? markdownSkillDescription(content) : (readStringProperty(content, "description") ?? ""),
      content,
      files: [],
    });
  }

  for (const id of dirs) {
    const prefix = `${dir}${id}/`;
    const skillPath = `${prefix}SKILL.md`;
    const markdown = context.contents.get(skillPath);
    if (markdown === undefined || !isSlug(id)) {
      context.warnings.push({ path: prefix, message: "A packaged skill needs a SKILL.md; these files are left as is." });
      continue;
    }
    const siblings = context.paths.filter((path) => path.startsWith(prefix) && path !== skillPath).sort();
    for (const path of [skillPath, ...siblings]) context.claimed.add(path);
    const { data } = parseFrontmatter(markdown);
    skills.push({
      id,
      format: "package",
      description: typeof data.description === "string" ? data.description : "",
      content: markdown,
      files: siblings.map((path) => ({ path: path.slice(prefix.length), content: context.contents.get(path) ?? "" })),
    });
  }

  return skills.sort((a, b) => a.id.localeCompare(b.id));
}

function connectionKind(source: string): ConnectionKind {
  switch (readDefinitionCallee(source)) {
    case "defineMcpClientConnection":
      return "mcp";
    case "defineOpenAPIConnection":
      return "openapi";
    case "defineDynamic":
      return "dynamic";
    default:
      return "other";
  }
}

function readConnections(context: Context, base: string): Connection[] {
  const connections: Connection[] = [];
  for (const path of listDirectory(context.paths, `${base}connections/`).files) {
    if (!isDefinitionModule(path)) continue;
    const id = stem(path);
    if (!isSlug(id)) continue;
    const source = context.contents.get(path) ?? "";
    context.claimed.add(path);

    const kind = connectionKind(source);
    const config = readAgentSource(source);
    const authText = config?.properties.get("auth")?.text;
    const auth: ConnectionAuth =
      authText === undefined
        ? config?.properties.has("headers")
          ? "custom"
          : "none"
        : /^connect\s*\(/.test(authText)
          ? "connect"
          : /getToken/.test(authText)
            ? "token"
            : "custom";
    const filterText = config?.properties.get(kind === "openapi" ? "operations" : "tools")?.text;

    connections.push({
      id,
      file: fileName(path),
      kind,
      description: readStringProperty(source, "description") ?? "",
      url: readStringProperty(source, "url"),
      spec: readStringProperty(source, "spec"),
      auth,
      connector: auth === "connect" && authText ? readConnectorValue(authText) : undefined,
      filter: filterText ? readFilterValue(filterText) : undefined,
      source,
    });
  }
  return connections;
}

function readSubagents(context: Context, base: string): Subagent[] {
  const dir = `${base}subagents/`;
  const { files, dirs } = listDirectory(context.paths, dir);
  const subagents: Subagent[] = [];

  for (const id of dirs) {
    const nodeBase = `${dir}${id}/`;
    const configPath = `${nodeBase}agent.ts`;
    const source = context.contents.get(configPath);
    if (source === undefined || !isSlug(id)) {
      context.warnings.push({ path: nodeBase, message: "A subagent directory needs an agent.ts; these files are left as is." });
      continue;
    }
    context.claimed.add(configPath);
    const settings = readSettings(source, configPath, context.warnings);
    const instructionsPath = `${nodeBase}instructions.md`;
    const instructions = context.contents.get(instructionsPath);
    if (instructions !== undefined) context.claimed.add(instructionsPath);

    subagents.push({
      id,
      kind: "local",
      description: settings.description ?? "",
      model: settings.model,
      reasoning: settings.reasoning,
      raw: settings.raw,
      source,
      instructions: instructions ?? "",
      hasInstructions: instructions !== undefined,
      tools: readTools(context, nodeBase),
      skills: readSkills(context, nodeBase),
      connections: readConnections(context, nodeBase),
      subagents: readSubagents(context, nodeBase),
    });
  }

  for (const path of files) {
    if (!isDefinitionModule(path)) continue;
    const id = stem(path);
    if (!isSlug(id)) continue;
    const source = context.contents.get(path) ?? "";
    context.claimed.add(path);
    subagents.push({
      id,
      kind: "remote",
      description: readStringProperty(source, "description") ?? "",
      raw: {},
      source,
      instructions: "",
      hasInstructions: false,
      tools: [],
      skills: [],
      connections: [],
      subagents: [],
    });
  }

  return subagents.sort((a, b) => a.id.localeCompare(b.id));
}

const PLATFORM_CHANNELS: ReadonlySet<string> = new Set([
  "eve",
  "slack",
  "discord",
  "teams",
  "telegram",
  "twilio",
  "github",
  "linear",
  "linq",
  "photon",
  "mcp",
  "chat-sdk",
]);

function channelKind(source: string): ChannelKind {
  const callee = readDefinitionCallee(source);
  if (callee === "disableRoute") return "disabled";
  if (callee === "defineChannel") return "custom";
  for (const specifier of readImports(source)) {
    const platform = /^eve\/channels\/([a-z-]+)$/.exec(specifier)?.[1];
    if (platform && PLATFORM_CHANNELS.has(platform)) return platform as ChannelKind;
  }
  return "other";
}

/** Channels are root-only in Eve. */
function readChannels(context: Context, base: string): Channel[] {
  const channels: Channel[] = [];
  for (const path of listDirectory(context.paths, `${base}channels/`).files) {
    if (!isDefinitionModule(path)) continue;
    const id = stem(path);
    if (!isSlug(id)) continue;
    const source = context.contents.get(path) ?? "";
    context.claimed.add(path);
    channels.push({ id, file: fileName(path), kind: channelKind(source), source });
  }
  return channels;
}

/** Schedules are root-only and may be nested; the path under `schedules/` is the name. */
function readSchedules(context: Context, base: string): Schedule[] {
  const dir = `${base}schedules/`;
  const schedules: Schedule[] = [];
  for (const path of context.paths) {
    if (!path.startsWith(dir)) continue;
    const file = path.slice(dir.length);
    const isMarkdown = file.endsWith(".md");
    if (!isMarkdown && !isDefinitionModule(file)) continue;
    const id = file.replace(/\.[^.]+$/, "");
    if (!scheduleIdSchema.safeParse(id).success) continue;
    const source = context.contents.get(path) ?? "";
    context.claimed.add(path);

    if (isMarkdown) {
      const { data, body } = parseFrontmatter(source);
      schedules.push({ id, file, format: "markdown", cron: typeof data.cron === "string" ? data.cron : "", prompt: body.trim(), handler: false, source });
    } else {
      schedules.push({
        id,
        file,
        format: "module",
        cron: readStringProperty(source, "cron") ?? "",
        prompt: readStringProperty(source, "markdown") ?? "",
        handler: readAgentSource(source)?.properties.has("run") ?? false,
        source,
      });
    }
  }
  return schedules.sort((a, b) => a.id.localeCompare(b.id));
}
