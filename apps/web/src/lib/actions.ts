"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "@evelab/auth";
import { applyOwnershipChange, OwnershipError } from "@evelab/eve-project";
import { isSafeRepoPath, newRepositoryNameSchema, repositoryNameSchema } from "@evelab/github";
import {
  commitProject,
  connectRepository,
  disconnectRepository,
  discardChange,
  importRepository,
  previewImport,
  publishToNewRepository,
  pullProject,
  sourceControlMessage,
} from "@/lib/git";
import { writeLayout } from "@/lib/layout";
import { forgetProject, recordProject, requireProjectAccess, requireSignedIn } from "@/lib/session";
import {
  fetchSkillCandidate,
  isSafeRelativePath,
  SkillImportError,
  type SkillCandidate,
} from "@/lib/skill-import";
import {
  createProject,
  deleteProject,
  readProject,
  readProjectFile,
  writeProject,
  writeProjectFile,
} from "@/lib/workspace";

/**
 * Every mutation validates its input, then checks the caller may touch the
 * project, before touching the project. Form data and imported metadata are
 * untrusted, and a server action can be called without the page that renders it.
 */

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const kebabSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and -");

/** Parses a project id and refuses callers who may not open that project. */
async function projectFrom(value: unknown): Promise<string> {
  const id = idSchema.parse(value);
  await requireProjectAccess(id);
  return id;
}

/* Sign-in. Plain forms, so they work before any JavaScript loads. */

export async function signInAction() {
  const auth = getAuth();
  if (!auth) redirect("/projects");
  const result = await auth.api.signInSocial({
    body: { provider: "github", callbackURL: "/projects" },
    headers: await headers(),
  });
  if (!("url" in result) || !result.url) throw new Error("GitHub sign-in is not available.");
  redirect(result.url);
}

export async function signOutAction() {
  const auth = getAuth();
  if (auth) await auth.api.signOut({ headers: await headers() });
  redirect(auth ? "/sign-in" : "/projects");
}

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
  await requireSignedIn();
  const id = await createProject(input);
  await claimOrRemove(id, input.name);
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

/** A directory nobody owns would be invisible to everyone, so an ownership failure removes it. */
async function claimOrRemove(id: string, name: string): Promise<void> {
  try {
    await recordProject(id, name);
  } catch (error) {
    await deleteProject(id);
    throw error;
  }
}

export async function deleteProjectAction(formData: FormData) {
  const id = await projectFrom(formData.get("id"));
  await deleteProject(id);
  await disconnectRepository(id);
  await forgetProject(id);
  revalidatePath("/projects");
  redirect("/projects");
}

const agentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).optional(),
});

export async function updateAgentAction(formData: FormData) {
  const id = await projectFrom(formData.get("id"));
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
  const id = await projectFrom(formData.get("id"));
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
  const id = await projectFrom(projectId);
  const project = await readProject(id);
  project.agent.instructions = z.string().max(500_000).parse(content);
  await writeProject(id, project);
  revalidatePath(`/projects/${id}`, "layout");
}

export async function readFileAction(projectId: string, path: string): Promise<string> {
  const id = await projectFrom(projectId);
  return readProjectFile(id, path);
}

export async function saveFileAction(projectId: string, path: string, content: string) {
  const id = await projectFrom(projectId);
  await writeProjectFile(id, path, z.string().max(2_000_000).parse(content));
  revalidatePath(`/projects/${id}`, "layout");
}

const toolSchema = z.object({
  id: kebabSchema,
  description: z.string().trim().max(280).default(""),
});

export async function createToolAction(formData: FormData) {
  const projectId = await projectFrom(formData.get("projectId"));
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
  // The canvas keeps the user in place; the Tools page sends them to the source.
  if (formData.get("openSource") === "true") {
    redirect(`/projects/${projectId}/files?path=tools/${input.id}.ts`);
  }
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
  const projectId = await projectFrom(formData.get("projectId"));
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
  const projectId = await projectFrom(formData.get("projectId"));
  const subagentId = kebabSchema.parse(formData.get("subagentId"));

  const project = await readProject(projectId);
  project.subagents = project.subagents.filter((subagent) => subagent.id !== subagentId);
  await writeProject(projectId, project);
  revalidatePath(`/projects/${projectId}`, "layout");
}

export async function deleteToolAction(formData: FormData) {
  const projectId = await projectFrom(formData.get("projectId"));
  const toolId = kebabSchema.parse(formData.get("toolId"));

  const project = await readProject(projectId);
  project.tools = project.tools.filter((tool) => tool.id !== toolId);
  // A subagent must not keep pointing at a tool that no longer exists.
  for (const subagent of project.subagents) {
    subagent.tools = subagent.tools.filter((id) => id !== toolId);
  }
  await writeProject(projectId, project);
  revalidatePath(`/projects/${projectId}`, "layout");
}

export async function deleteSkillAction(formData: FormData) {
  const projectId = await projectFrom(formData.get("projectId"));
  const skillId = kebabSchema.parse(formData.get("skillId"));

  const project = await readProject(projectId);
  project.skills = project.skills.filter((skill) => skill.id !== skillId);
  for (const subagent of project.subagents) {
    subagent.skills = subagent.skills.filter((id) => id !== skillId);
  }
  await writeProject(projectId, project);
  revalidatePath(`/projects/${projectId}`, "layout");
}

/** Canvas node positions. Presentation state, stored outside the project. */
export async function saveLayoutAction(
  projectId: string,
  positions: Record<string, { x: number; y: number }>,
) {
  const id = await projectFrom(projectId);
  const parsed = z
    .record(z.object({ x: z.number().finite(), y: z.number().finite() }))
    .parse(positions);
  await writeLayout(id, { positions: parsed });
}

const linkSchema = z.object({
  owner: z.union([z.literal("agent"), z.string().regex(/^subagent:[a-z0-9][a-z0-9-]*$/)]),
  capability: z.string().regex(/^(tool|skill):[a-z0-9][a-z0-9-]*$/),
});

const ownershipSchema = z
  .object({ projectId: idSchema, remove: linkSchema.optional(), add: linkSchema.optional() })
  .refine((input) => input.remove || input.add, { message: "Nothing to change" });

/**
 * Moves a tool or skill between the agent and its subagents: an edge dragged on
 * the canvas. Writes subagent frontmatter and nothing else.
 */
export async function changeOwnershipAction(
  input: z.input<typeof ownershipSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { projectId, remove, add } = ownershipSchema.parse(input);
  await requireProjectAccess(projectId);
  const project = await readProject(projectId);
  try {
    await writeProject(projectId, applyOwnershipChange(project, { remove, add }));
  } catch (error) {
    if (error instanceof OwnershipError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true };
}

/**
 * Reads a candidate skill so the user can see the source and every file before
 * anything is written. This does not install.
 */
export async function previewSkillAction(
  url: string,
): Promise<{ ok: true; candidate: SkillCandidate } | { ok: false; message: string }> {
  await requireSignedIn();
  try {
    const candidate = await fetchSkillCandidate(z.string().url().parse(url));
    return { ok: true, candidate };
  } catch (error) {
    if (error instanceof SkillImportError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: "That is not a valid URL." };
    return { ok: false, message: "Could not read that skill." };
  }
}

const installSkillSchema = z.object({
  projectId: idSchema,
  id: kebabSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
  source: z.string().url(),
  files: z
    .array(
      z.object({
        // Nested paths are allowed (scripts/run.sh), traversal is not.
        path: z.string().min(1).max(200).refine(isSafeRelativePath, {
          message: "Unsafe skill file path",
        }),
        content: z.string().max(256 * 1024),
      }),
    )
    .min(1)
    .max(60),
});

/** Writes a reviewed skill into the project. Called only after confirmation. */
export async function installSkillAction(input: z.input<typeof installSkillSchema>) {
  const parsed = installSkillSchema.parse(input);
  const projectId = parsed.projectId;
  await requireProjectAccess(projectId);

  const markdown = parsed.files.find((file) => file.path === "SKILL.md");
  if (!markdown) throw new Error("A skill needs a SKILL.md.");

  const project = await readProject(projectId);
  if (project.skills.some((skill) => skill.id === parsed.id)) {
    throw new Error(`A skill named "${parsed.id}" is already installed.`);
  }

  project.skills.push({
    id: parsed.id,
    name: parsed.name,
    description: parsed.description,
    source: parsed.source,
    markdown: markdown.content,
    files: parsed.files.filter((file) => file.path !== "SKILL.md"),
  });

  await writeProject(projectId, project);
  revalidatePath(`/projects/${projectId}`, "layout");
}

/*
 * Source control. These return a result instead of throwing, so a GitHub
 * failure reaches the user as a sentence rather than an error page. Access
 * failures still throw: they are not something to explain to the caller.
 */

type Failure = { ok: false; message: string };

async function sourceControl<T extends object>(run: () => Promise<T>): Promise<({ ok: true } & T) | Failure> {
  try {
    return { ok: true as const, ...(await run()) };
  } catch (error) {
    const message = sourceControlMessage(error);
    if (message) return { ok: false, message };
    throw error;
  }
}

const branchInput = z.string().trim().max(200).optional();

export async function previewImportAction(input: { repository: string; branch?: string }) {
  await requireSignedIn();
  return sourceControl(async () => {
    const parsed = z.object({ repository: repositoryNameSchema, branch: branchInput }).parse(input);
    return { preview: await previewImport(parsed.repository, parsed.branch) };
  });
}

export async function importRepositoryAction(input: { repository: string; branch: string; commit: string }) {
  await requireSignedIn();
  return sourceControl(async () => {
    const parsed = z
      .object({ repository: repositoryNameSchema, branch: z.string().trim().min(1).max(200), commit: z.string().regex(/^[0-9a-f]{40}$/) })
      .parse(input);
    const projectId = await importRepository(parsed.repository, parsed.branch, parsed.commit);
    try {
      await claimOrRemove(projectId, projectId);
    } catch (error) {
      await disconnectRepository(projectId);
      throw error;
    }
    revalidatePath("/projects");
    return { projectId };
  });
}

export async function connectRepositoryAction(input: { projectId: string; repository: string; branch?: string }) {
  const parsed = z.object({ projectId: idSchema, repository: repositoryNameSchema, branch: branchInput }).parse(input);
  await requireProjectAccess(parsed.projectId);
  return sourceControl(async () => {
    const result = await connectRepository(parsed.projectId, parsed.repository, parsed.branch);
    revalidatePath(`/projects/${parsed.projectId}`, "layout");
    return result;
  });
}

export async function createRepositoryAction(input: {
  projectId: string;
  name: string;
  isPrivate: boolean;
  message: string;
}) {
  const projectId = await projectFrom(input.projectId);
  return sourceControl(async () => {
    const parsed = z
      .object({
        name: newRepositoryNameSchema,
        isPrivate: z.boolean(),
        message: z.string().trim().min(1, "Write a commit message").max(5000),
      })
      .parse(input);
    const result = await publishToNewRepository(projectId, parsed.name, parsed.isPrivate, parsed.message);
    revalidatePath(`/projects/${projectId}`, "layout");
    return result;
  });
}

/** Commits every local change. The commit is created on GitHub, so this is also the push. */
export async function commitAction(input: { projectId: string; message: string }) {
  const projectId = await projectFrom(input.projectId);
  return sourceControl(async () => {
    const { message } = z
      .object({ message: z.string().trim().min(1, "Write a commit message").max(5000) })
      .parse(input);
    const result = await commitProject(projectId, message);
    revalidatePath(`/projects/${projectId}`, "layout");
    return result;
  });
}

export async function pullAction(input: { projectId: string }) {
  const projectId = await projectFrom(input.projectId);
  return sourceControl(async () => {
    const result = await pullProject(projectId);
    revalidatePath(`/projects/${projectId}`, "layout");
    return { result };
  });
}

export async function discardChangeAction(input: { projectId: string; path: string }) {
  const projectId = await projectFrom(input.projectId);
  return sourceControl(async () => {
    const { path } = z.object({ path: z.string().refine(isSafeRepoPath, { message: "Unsafe path" }) }).parse(input);
    await discardChange(projectId, path);
    revalidatePath(`/projects/${projectId}`, "layout");
    return {};
  });
}

export async function disconnectRepositoryAction(formData: FormData) {
  const id = await projectFrom(formData.get("projectId"));
  await disconnectRepository(id);
  revalidatePath(`/projects/${id}`, "layout");
}
