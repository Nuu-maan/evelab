import { eveProjectSchema, filePathSchema, type EveProject } from "./types.js";

export interface ValidationIssue {
  level: "error" | "warning";
  /** Dotted path into the project model, e.g. "subagents.researcher.tools". */
  at: string;
  message: string;
}

/**
 * Structural and referential checks that Zod cannot express on its own.
 * Imported projects are untrusted input, so this runs on every import.
 */
export function validateProject(project: EveProject): ValidationIssue[] {
  const parsed = eveProjectSchema.safeParse(project);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      level: "error" as const,
      at: issue.path.join("."),
      message: issue.message,
    }));
  }

  const issues: ValidationIssue[] = [];
  const value = parsed.data;

  if (!value.agent.model.id) {
    issues.push({ level: "error", at: "agent.model.id", message: "No model selected." });
  }
  if (value.agent.instructions.trim().length === 0) {
    issues.push({
      level: "warning",
      at: "agent.instructions",
      message: "instructions.md is empty.",
    });
  }

  for (const file of value.files) {
    const path = filePathSchema.safeParse(file.path);
    if (!path.success) {
      issues.push({ level: "error", at: `files.${file.path}`, message: "Unsafe file path." });
    }
  }

  issues.push(...duplicates(value.tools.map((t) => t.id), "tools"));
  issues.push(...duplicates(value.skills.map((s) => s.id), "skills"));
  issues.push(...duplicates(value.subagents.map((s) => s.id), "subagents"));

  const toolIds = new Set(value.tools.map((tool) => tool.id));
  const skillIds = new Set(value.skills.map((skill) => skill.id));
  for (const subagent of value.subagents) {
    for (const tool of subagent.tools) {
      if (!toolIds.has(tool)) {
        issues.push({
          level: "warning",
          at: `subagents.${subagent.id}.tools`,
          message: `References unknown tool "${tool}".`,
        });
      }
    }
    for (const skill of subagent.skills) {
      if (!skillIds.has(skill)) {
        issues.push({
          level: "warning",
          at: `subagents.${subagent.id}.skills`,
          message: `References unknown skill "${skill}".`,
        });
      }
    }
  }

  return issues;
}

function duplicates(ids: string[], at: string): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      issues.push({ level: "error", at, message: `Duplicate id "${id}".` });
    }
    seen.add(id);
  }
  return issues;
}
