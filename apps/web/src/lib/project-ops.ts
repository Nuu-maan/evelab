import "server-only";
import { z } from "zod";
import {
  agentPath,
  renderConnectionModule,
  renderScheduleMarkdown,
  renderToolModule,
  type EveProject,
} from "@evelab/eve-project";
import { readProject, writeProject } from "@/lib/workspace";

/**
 * Project edits shared by server actions and the AI assistant, so a tool the
 * assistant creates is the same file a person creating it by hand would get.
 * Each operation validates its input, writes through `writeProject`, and
 * returns the path it wrote so the caller can point at it.
 */

export class ProjectOpError extends Error {}

/** Eve derives names from file and directory names: letters, digits, - and _. */
export const entityNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, "Use letters, digits, - and _");

function assertNameFree(project: EveProject, name: string): void {
  if (project.tools.some((tool) => tool.id === name)) throw new ProjectOpError(`There is already a tool named "${name}".`);
  if (project.subagents.some((subagent) => subagent.id === name)) {
    throw new ProjectOpError(`There is already a subagent named "${name}".`);
  }
}

export const createToolInput = z.object({
  name: entityNameSchema,
  description: z.string().trim().max(500).default(""),
  /** Full module source. When omitted, the defineTool scaffold is written. */
  source: z.string().max(200_000).optional(),
});

export async function createTool(projectId: string, input: z.input<typeof createToolInput>): Promise<{ path: string }> {
  const value = createToolInput.parse(input);
  const project = await readProject(projectId);
  assertNameFree(project, value.name);
  const description = value.description || `The ${value.name} tool.`;
  project.tools.push({
    id: value.name,
    file: `${value.name}.ts`,
    description,
    kind: "tool",
    source: value.source ?? renderToolModule(description),
  });
  await writeProject(projectId, project);
  return { path: agentPath(project.root, `tools/${value.name}.ts`) };
}

export const createSubagentInput = z.object({
  name: entityNameSchema,
  description: z.string().trim().min(1, "Eve needs a description to route work to a subagent").max(500),
  instructions: z.string().max(50_000).optional(),
  model: z.string().trim().max(200).optional(),
});

export async function createSubagent(projectId: string, input: z.input<typeof createSubagentInput>): Promise<{ path: string }> {
  const value = createSubagentInput.parse(input);
  const project = await readProject(projectId);
  assertNameFree(project, value.name);
  project.subagents.push({
    id: value.name,
    kind: "local",
    description: value.description,
    model: value.model ? { id: value.model } : undefined,
    raw: {},
    source: "",
    instructions: value.instructions?.trim() ? `${value.instructions.trim()}\n` : `# ${value.name}\n\n${value.description}\n`,
    hasInstructions: true,
    tools: [],
    skills: [],
    connections: [],
    subagents: [],
  });
  await writeProject(projectId, project);
  return { path: agentPath(project.root, `subagents/${value.name}/agent.ts`) };
}

export const createConnectionInput = z
  .object({
    name: entityNameSchema,
    kind: z.enum(["mcp", "openapi"]),
    url: z
      .string()
      .trim()
      .url()
      .refine((value) => value.startsWith("https://") || value.startsWith("http://localhost"), { message: "Use an https URL" }),
    description: z.string().trim().max(500).default(""),
    auth: z.enum(["none", "connect", "token"]).default("none"),
    connector: z.string().trim().max(200).optional(),
    tokenEnv: z
      .string()
      .trim()
      .regex(/^[A-Z_][A-Z0-9_]*$/, "Use an environment variable name like LINEAR_API_KEY")
      .optional(),
    allow: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
  })
  .refine((input) => input.auth !== "connect" || input.connector, { message: "Enter the Vercel Connect connector", path: ["connector"] })
  .refine((input) => input.auth !== "token" || input.tokenEnv, {
    message: "Enter the environment variable that holds the token",
    path: ["tokenEnv"],
  });

export async function createConnection(projectId: string, input: z.input<typeof createConnectionInput>): Promise<{ path: string }> {
  const value = createConnectionInput.parse(input);
  const project = await readProject(projectId);
  if (project.connections.some((connection) => connection.id === value.name)) {
    throw new ProjectOpError(`There is already a connection named "${value.name}".`);
  }
  const filter = value.allow && value.allow.length > 0 ? { mode: "allow" as const, names: value.allow } : undefined;
  project.connections.push({
    id: value.name,
    file: `${value.name}.ts`,
    kind: value.kind,
    description: value.description,
    url: value.kind === "mcp" ? value.url : undefined,
    spec: value.kind === "openapi" ? value.url : undefined,
    auth: value.auth,
    connector: value.auth === "connect" ? value.connector : undefined,
    filter,
    source: renderConnectionModule({
      kind: value.kind,
      url: value.url,
      description: value.description,
      auth: value.auth,
      connector: value.connector,
      tokenEnv: value.tokenEnv,
      filter,
    }),
  });
  await writeProject(projectId, project);
  return { path: agentPath(project.root, `connections/${value.name}.ts`) };
}

export const createScheduleInput = z.object({
  name: entityNameSchema,
  cron: z
    .string()
    .trim()
    .refine((value) => value.split(/\s+/).length === 5, { message: "Use a five-field cron expression" }),
  prompt: z.string().trim().min(1, "Write what the agent should do").max(20_000),
});

export async function createSchedule(projectId: string, input: z.input<typeof createScheduleInput>): Promise<{ path: string }> {
  const value = createScheduleInput.parse(input);
  const project = await readProject(projectId);
  if (project.schedules.some((schedule) => schedule.id === value.name)) {
    throw new ProjectOpError(`There is already a schedule named "${value.name}".`);
  }
  project.schedules.push({
    id: value.name,
    file: `${value.name}.md`,
    format: "markdown",
    cron: value.cron,
    prompt: value.prompt,
    handler: false,
    source: renderScheduleMarkdown(value.cron, value.prompt),
  });
  await writeProject(projectId, project);
  return { path: agentPath(project.root, `schedules/${value.name}.md`) };
}

export async function writeInstructions(projectId: string, content: string): Promise<{ path: string }> {
  const project = await readProject(projectId);
  project.agent.instructions = z.string().max(500_000).parse(content);
  await writeProject(projectId, project);
  return { path: agentPath(project.root, "instructions.md") };
}

/** A compact description of the project for a model to reason about. */
export async function describeProject(projectId: string): Promise<Record<string, unknown>> {
  const project = await readProject(projectId);
  return {
    name: project.agent.name,
    layout: project.root ? "agent/" : "flat",
    model: project.agent.model?.id || project.agent.model?.expression || "Eve default",
    reasoning: project.agent.reasoning,
    description: project.agent.description,
    instructions: project.agent.instructions.slice(0, 8000),
    tools: project.tools.map((tool) => ({ name: tool.id, kind: tool.kind, description: tool.description })),
    skills: project.skills.map((skill) => ({ name: skill.id, description: skill.description })),
    subagents: project.subagents.map((subagent) => ({
      name: subagent.id,
      description: subagent.description,
      tools: subagent.tools.map((tool) => tool.id),
    })),
    connections: project.connections.map((connection) => ({
      name: connection.id,
      kind: connection.kind,
      url: connection.url ?? connection.spec,
      auth: connection.auth,
    })),
    channels: project.channels.map((channel) => ({ name: channel.id, kind: channel.kind })),
    schedules: project.schedules.map((schedule) => ({ name: schedule.id, cron: schedule.cron })),
    files: project.files.map((file) => file.path),
  };
}
