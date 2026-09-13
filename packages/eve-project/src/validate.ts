import { eveProjectSchema, filePathSchema, type Connection, type EveProject, type Skill, type Subagent, type Tool } from "./types.js";

export interface ValidationIssue {
  level: "error" | "warning";
  /** Dotted path into the project model, e.g. "subagents.researcher.description". */
  at: string;
  message: string;
}

/**
 * The checks Eve's compiler would fail on, caught before a run. Imported
 * projects are untrusted input, so this runs on every import.
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
  const base = value.root ? `${value.root}/` : "";

  const hasInstructionsFile = value.files.some((file) => file.path === `${base}instructions.md`);
  if (!hasInstructionsFile && value.agent.instructionSources.length === 0) {
    issues.push({ level: "error", at: "agent.instructions", message: "The root agent needs instructions.md." });
  } else if (hasInstructionsFile && value.agent.instructions.trim().length === 0) {
    issues.push({ level: "warning", at: "agent.instructions", message: "instructions.md is empty." });
  }

  if (value.agent.hasConfig && !value.agent.model?.id && !value.agent.model?.expression && value.agent.raw.model === undefined) {
    issues.push({ level: "error", at: "agent.model", message: "agent.ts must set a model." });
  }

  for (const file of value.files) {
    if (!filePathSchema.safeParse(file.path).success) {
      issues.push({ level: "error", at: `files.${file.path}`, message: "Unsafe file path." });
    }
  }

  checkOwner(issues, "", value);

  for (const schedule of value.schedules) {
    const at = `schedules.${schedule.id}`;
    if (schedule.cron.trim().split(/\s+/).length !== 5) {
      issues.push({ level: "error", at: `${at}.cron`, message: "A schedule needs a five-field cron expression." });
    }
    if (!schedule.handler && schedule.prompt.trim().length === 0) {
      issues.push({ level: "warning", at: `${at}.prompt`, message: "This schedule has no prompt to run." });
    }
  }

  return issues;
}

interface CapabilityOwner {
  tools: Tool[];
  skills: Skill[];
  connections: Connection[];
  subagents: Subagent[];
}

function checkOwner(issues: ValidationIssue[], prefix: string, owner: CapabilityOwner): void {
  issues.push(...duplicates(owner.tools.map((tool) => tool.id), `${prefix}tools`));
  issues.push(...duplicates(owner.skills.map((skill) => skill.id), `${prefix}skills`));
  issues.push(...duplicates(owner.connections.map((connection) => connection.id), `${prefix}connections`));
  issues.push(...duplicates(owner.subagents.map((subagent) => subagent.id), `${prefix}subagents`));

  // Subagents become tools named after their directory, in the same namespace as authored tools.
  const toolIds = new Set(owner.tools.map((tool) => tool.id));
  for (const subagent of owner.subagents) {
    const at = `${prefix}subagents.${subagent.id}`;
    if (toolIds.has(subagent.id)) {
      issues.push({ level: "error", at, message: `A tool and a subagent are both named "${subagent.id}".` });
    }
    if (subagent.kind === "local") {
      if (!subagent.description.trim() && subagent.raw.description === undefined) {
        issues.push({ level: "error", at: `${at}.description`, message: "A subagent needs a description." });
      }
      checkOwner(issues, `${at}.`, subagent);
    }
  }

  for (const connection of owner.connections) {
    if ((connection.kind === "mcp" || connection.kind === "openapi") && !connection.description.trim()) {
      issues.push({
        level: "warning",
        at: `${prefix}connections.${connection.id}.description`,
        message: "The model finds connection tools through their description.",
      });
    }
  }
}

function duplicates(ids: string[], at: string): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const id of ids) {
    if (seen.has(id)) issues.push({ level: "error", at, message: `Two entries are named "${id}".` });
    seen.add(id);
  }
  return issues;
}
