"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createProject,
  deleteProject,
  readProject,
  writeProject,
  writeProjectFile,
} from "@/lib/workspace";

/**
 * Every mutation validates its input before touching the project. Form data and
 * imported metadata are untrusted.
 */

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const kebabSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and -");

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(280).optional(),
  modelId: z.string().trim().min(1, "Choose a model"),
});

export async function createProjectAction(formData: FormData) {
  const input = createSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    modelId: formData.get("modelId"),
  });
  const id = await createProject(input);
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

export async function deleteProjectAction(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  await deleteProject(id);
  revalidatePath("/projects");
  redirect("/projects");
}

const agentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).optional(),
});

export async function updateAgentAction(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const input = agentSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  const project = await readProject(id);
  project.agent.name = input.name;
  project.agent.description = input.description;
  await writeProject(id, project);
  revalidatePath(`/projects/${id}`, "layout");
}

const modelSchema = z.object({
  modelId: z.string().trim().min(1),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxOutputTokens: z.coerce.number().int().positive().optional(),
});

export async function updateModelAction(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const input = modelSchema.parse({
    modelId: formData.get("modelId"),
    temperature: formData.get("temperature") || undefined,
    maxOutputTokens: formData.get("maxOutputTokens") || undefined,
  });

  const project = await readProject(id);
  project.agent.model = {
    ...project.agent.model,
    id: input.modelId,
    temperature: input.temperature,
    maxOutputTokens: input.maxOutputTokens,
  };
  await writeProject(id, project);
  revalidatePath(`/projects/${id}`, "layout");
}

export async function saveInstructionsAction(projectId: string, content: string) {
  const id = idSchema.parse(projectId);
  const project = await readProject(id);
  project.agent.instructions = z.string().max(500_000).parse(content);
  await writeProject(id, project);
  revalidatePath(`/projects/${id}`, "layout");
}

export async function saveFileAction(projectId: string, path: string, content: string) {
  const id = idSchema.parse(projectId);
  await writeProjectFile(id, path, z.string().max(2_000_000).parse(content));
  revalidatePath(`/projects/${id}`, "layout");
}

const toolSchema = z.object({
  id: kebabSchema,
  description: z.string().trim().max(280).default(""),
});

export async function createToolAction(formData: FormData) {
  const projectId = idSchema.parse(formData.get("projectId"));
  const input = toolSchema.parse({
    id: formData.get("toolId"),
    description: formData.get("description") ?? "",
  });

  const project = await readProject(projectId);
  if (project.tools.some((tool) => tool.id === input.id)) {
    throw new Error(`A tool named "${input.id}" already exists.`);
  }

  const symbol = input.id.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
  project.tools.push({
    id: input.id,
    name: input.id,
    description: input.description,
    origin: "custom",
    enabled: true,
    source: toolTemplate(symbol, input.id, input.description),
  });
  await writeProject(projectId, project);
  revalidatePath(`/projects/${projectId}`, "layout");
  redirect(`/projects/${projectId}/files?path=tools/${input.id}.ts`);
}

/**
 * TODO: confirm the exact tool factory and option names against the current Eve
 * docs. The generated file is plain source the user can edit immediately, so a
 * mismatch is visible and fixable rather than hidden behind an abstraction.
 */
function toolTemplate(symbol: string, id: string, description: string): string {
  return `import { tool } from "eve";
import { z } from "zod";

export const ${symbol} = tool({
  name: ${JSON.stringify(id)},
  description: ${JSON.stringify(description || `The ${id} tool.`)},
  inputSchema: z.object({
    query: z.string().describe("What to act on"),
  }),
  async execute({ query }) {
    return \`TODO: implement ${id} for \${query}\`;
  },
});
`;
}

const subagentSchema = z.object({
  id: kebabSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).default(""),
  modelId: z.string().trim().optional(),
});

export async function createSubagentAction(formData: FormData) {
  const projectId = idSchema.parse(formData.get("projectId"));
  const input = subagentSchema.parse({
    id: formData.get("subagentId"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    modelId: formData.get("modelId") || undefined,
  });

  const project = await readProject(projectId);
  if (project.subagents.some((subagent) => subagent.id === input.id)) {
    throw new Error(`A subagent named "${input.id}" already exists.`);
  }

  project.subagents.push({
    id: input.id,
    name: input.name,
    description: input.description,
    model: input.modelId ? { id: input.modelId, raw: {} } : undefined,
    instructions: `Describe what ${input.name} is responsible for.\n`,
    tools: [],
    skills: [],
    raw: {},
  });
  await writeProject(projectId, project);
  revalidatePath(`/projects/${projectId}`, "layout");
}

export async function deleteSubagentAction(formData: FormData) {
  const projectId = idSchema.parse(formData.get("projectId"));
  const subagentId = kebabSchema.parse(formData.get("subagentId"));

  const project = await readProject(projectId);
  project.subagents = project.subagents.filter((subagent) => subagent.id !== subagentId);
  await writeProject(projectId, project);
  revalidatePath(`/projects/${projectId}`, "layout");
}
