import "server-only";
import { stepCountIs, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import {
  createConnection,
  createConnectionInput,
  createSchedule,
  createScheduleInput,
  createSubagent,
  createSubagentInput,
  createTool,
  createToolInput,
  describeProject,
  ProjectOpError,
  writeInstructions,
} from "@/lib/project-ops";
import { platformProducts } from "@/lib/vercel-platform";
import { readProjectFile } from "@/lib/workspace";

/**
 * EveLab's assistant: an AI SDK agent that builds the user's Eve agent by
 * editing its files through the same operations the UI uses. It runs through
 * AI Gateway, so the model is a plain gateway id and there is no provider key.
 */

export const ASSISTANT_MODEL = process.env.EVELAB_ASSISTANT_MODEL ?? "anthropic/claude-sonnet-5";

export function assistantAvailable(): boolean {
  return platformProducts(process.env).find((product) => product.id === "ai-gateway")?.configured ?? false;
}

const INSTRUCTIONS = `You are EveLab's assistant. You help the user build an agent with eve, Vercel's filesystem-first framework for durable backend AI agents.

An eve agent is a directory of files: agent/agent.ts (defineAgent with the model), agent/instructions.md, tools under agent/tools (defineTool from "eve/tools"), skills, subagents under agent/subagents/<name>/ (each with its own agent.ts, instructions and tools; a subagent inherits nothing), connections (MCP servers and OpenAPI services), channels, and cron schedules.

How to work:
- Call read_project before changing anything, so you know what exists.
- Make changes with the tools; never paste file contents for the user to copy.
- Prefer a connection over a hand-written tool when a hosted MCP server or OpenAPI document exists for the service.
- For credentials, use Vercel Connect (auth "connect" with a connector id) or a token read from an environment variable. Never write a secret into a file.
- Tool code must be a complete module: import { defineTool } from "eve/tools", import { z } from "zod", export default defineTool({ description, inputSchema, execute }).
- Keep instructions concrete: identity, what the agent does, what it must never do, and how it replies.
- After changing files, say in one or two sentences what you changed. Do not use em dashes.`;

function result<T>(run: () => Promise<T>) {
  return run().catch((error: unknown) => {
    if (error instanceof ProjectOpError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: error.issues.map((issue) => issue.message).join("; ") };
    throw error;
  });
}

export function createAssistant(projectId: string) {
  return new ToolLoopAgent({
    model: ASSISTANT_MODEL,
    instructions: INSTRUCTIONS,
    stopWhen: stepCountIs(16),
    tools: {
      read_project: tool({
        description: "Read the project: model, instructions, tools, skills, subagents, connections, channels, schedules and file list.",
        inputSchema: z.object({}),
        execute: () => describeProject(projectId),
      }),
      read_file: tool({
        description: "Read one file from the project by its path, such as agent/agent.ts.",
        inputSchema: z.object({ path: z.string().min(1).max(300) }),
        execute: ({ path }) =>
          result(async () => {
            const content = await readProjectFile(projectId, path);
            return { path, content: content.slice(0, 60_000) };
          }),
      }),
      write_instructions: tool({
        description: "Replace the agent's instructions.md with new markdown.",
        inputSchema: z.object({ content: z.string().min(1).max(100_000) }),
        execute: ({ content }) => result(() => writeInstructions(projectId, content)),
      }),
      create_tool: tool({
        description: "Create a TypeScript tool file under agent/tools. Pass full source to write real code, or omit it for the scaffold.",
        inputSchema: createToolInput,
        execute: (input) => result(() => createTool(projectId, input)),
      }),
      create_subagent: tool({
        description: "Create a subagent directory with its own agent.ts and instructions.",
        inputSchema: createSubagentInput,
        execute: (input) => result(() => createSubagent(projectId, input)),
      }),
      add_connection: tool({
        description: "Connect an MCP server or OpenAPI service. Its tools reach the model as <name>__<tool>.",
        inputSchema: createConnectionInput,
        execute: (input) => result(() => createConnection(projectId, input)),
      }),
      add_schedule: tool({
        description: "Add a cron schedule that starts the agent with a prompt. Cron is five fields, in UTC.",
        inputSchema: createScheduleInput,
        execute: (input) => result(() => createSchedule(projectId, input)),
      }),
    },
  });
}
