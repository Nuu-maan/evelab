import { z } from "zod";

/**
 * The EveLab project model.
 *
 * This is NOT a replacement for Eve's own representation. It is an internal,
 * lossless-by-design view of a real Eve project, used to translate between GUI
 * state and files on disk. Anything EveLab does not model explicitly is carried
 * through verbatim in `raw` fields so a round trip never drops information.
 */

export const filePathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), {
    message: "Project paths must be relative and must not traverse upwards",
  });

export const projectFileSchema = z.object({
  path: filePathSchema,
  content: z.string(),
});
export type ProjectFile = z.infer<typeof projectFileSchema>;

export const modelConfigSchema = z.object({
  /** Model identifier exactly as Eve expects it, e.g. "openai/gpt-5.6". Empty when the source computes it. */
  id: z.string().default(""),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  /** Provider-specific options EveLab does not model; emitted verbatim. */
  raw: z.record(z.string()).default({}),
});
export type ModelConfig = z.infer<typeof modelConfigSchema>;

export const agentConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  model: modelConfigSchema,
  /** Path to the instructions markdown file, relative to the project root. */
  instructionsPath: filePathSchema.default("instructions.md"),
  instructions: z.string().default(""),
  /**
   * Properties present in the source agent config that EveLab has no GUI for.
   * Keys map to the verbatim source text of the value expression.
   */
  raw: z.record(z.string()).default({}),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;

export const toolOriginSchema = z.enum(["custom", "mcp", "eve", "extension"]);
export type ToolOrigin = z.infer<typeof toolOriginSchema>;

export const toolSchema = z.object({
  /** Stable identifier; also the file stem under tools/. */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Use kebab-case tool ids"),
  name: z.string().min(1),
  description: z.string().default(""),
  origin: toolOriginSchema.default("custom"),
  enabled: z.boolean().default(true),
  /** Full source of the tool module, kept as the source of truth. */
  source: z.string().default(""),
});
export type Tool = z.infer<typeof toolSchema>;

export const skillSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Use kebab-case skill ids"),
  name: z.string().min(1),
  description: z.string().default(""),
  /** Where the skill came from, shown to the user before install. */
  source: z.string().optional(),
  /** Contents of SKILL.md. */
  markdown: z.string().default(""),
  /** Additional files shipped with the skill, relative to the skill directory. */
  files: z.array(projectFileSchema).default([]),
});
export type Skill = z.infer<typeof skillSchema>;

export const subagentSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Use kebab-case subagent ids"),
  name: z.string().min(1),
  description: z.string().default(""),
  model: modelConfigSchema.optional(),
  instructions: z.string().default(""),
  tools: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  /** Frontmatter keys EveLab has no GUI for; re-emitted verbatim. */
  raw: z.record(z.union([z.string(), z.array(z.string())])).default({}),
});
export type Subagent = z.infer<typeof subagentSchema>;

export const eveProjectSchema = z.object({
  agent: agentConfigSchema,
  tools: z.array(toolSchema).default([]),
  skills: z.array(skillSchema).default([]),
  subagents: z.array(subagentSchema).default([]),
  /**
   * Every file of the source project, including ones EveLab does not interpret
   * (package.json, lockfiles, .env.example, tests). Generation re-emits these
   * untouched, which is what keeps import -> edit -> export non-destructive.
   */
  files: z.array(projectFileSchema).default([]),
});
export type EveProject = z.infer<typeof eveProjectSchema>;

/** Files EveLab owns and regenerates from the model rather than passing through. */
export function isGeneratedPath(path: string): boolean {
  return (
    path === "agent.ts" ||
    path === "instructions.md" ||
    path.startsWith("tools/") ||
    path.startsWith("skills/") ||
    path.startsWith("subagents/")
  );
}
