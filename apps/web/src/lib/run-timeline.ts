/**
 * Turns an eve session stream into the timeline the Runs page draws.
 *
 * Pure and shared by the server (which records streams) and the client (which
 * renders them live). Events come from the eve HTTP API as NDJSON; the field
 * names follow eve's `protocol/message` types in eve 0.54.3. Unknown events are
 * ignored rather than guessed at.
 */

export interface EveEvent {
  type: string;
  data?: Record<string, unknown>;
  meta?: { id?: string; at?: string };
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type TimelineItem =
  | { kind: "user"; id: string; text: string; at?: string }
  | { kind: "assistant"; id: string; text: string; done: boolean; at?: string }
  | { kind: "reasoning"; id: string; text: string; done: boolean }
  | {
      kind: "tool";
      id: string;
      name: string;
      input: unknown;
      output?: unknown;
      status: "running" | "completed" | "failed" | "rejected";
      error?: string;
      startedAt?: string;
      endedAt?: string;
    }
  | { kind: "subagent"; id: string; name: string; childSessionId?: string; output?: string; done: boolean }
  | {
      kind: "input";
      id: string;
      prompt: string;
      toolName?: string;
      options: { id: string; label: string; style?: string }[];
      outcome?: string;
    }
  | { kind: "authorization"; id: string; name: string; description: string; url?: string; outcome?: string }
  | { kind: "error"; id: string; code: string; message: string }
  | { kind: "turn"; id: string; status: "completed" | "failed" | "cancelled"; usage: Usage; startedAt?: string; endedAt?: string };

export type SessionStatus = "starting" | "running" | "waiting" | "input" | "failed" | "completed";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Milliseconds between two ISO timestamps, or undefined when either is missing. */
export function durationMs(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const ms = Date.parse(end) - Date.parse(start);
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

export function buildTimeline(events: readonly EveEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const byId = new Map<string, TimelineItem>();
  const turnUsage = new Map<string, Usage>();
  const turnStart = new Map<string, string | undefined>();

  const add = (item: TimelineItem) => {
    items.push(item);
    byId.set(`${item.kind}:${item.id}`, item);
  };
  const find = <K extends TimelineItem["kind"]>(kind: K, id: string) =>
    byId.get(`${kind}:${id}`) as Extract<TimelineItem, { kind: K }> | undefined;

  events.forEach((event, index) => {
    const data = record(event.data);
    const at = event.meta?.at;
    const turnId = text(data.turnId);
    const stepKey = `${turnId}:${number(data.stepIndex)}:${number(data.sequence)}`;

    switch (event.type) {
      case "turn.started":
        turnStart.set(turnId, at);
        turnUsage.set(turnId, { inputTokens: 0, outputTokens: 0, costUsd: 0 });
        break;
      case "message.received":
        add({ kind: "user", id: event.meta?.id ?? `user-${index}`, text: text(data.message), at });
        break;
      case "reasoning.appended": {
        const item = find("reasoning", stepKey);
        if (item) item.text += text(data.reasoningDelta);
        else add({ kind: "reasoning", id: stepKey, text: text(data.reasoningDelta), done: false });
        break;
      }
      case "reasoning.completed": {
        const item = find("reasoning", stepKey);
        if (item) Object.assign(item, { text: text(data.reasoning), done: true });
        else add({ kind: "reasoning", id: stepKey, text: text(data.reasoning), done: true });
        break;
      }
      case "message.appended": {
        const item = find("assistant", stepKey);
        if (item && !item.done) item.text += text(data.messageDelta);
        else if (!item) add({ kind: "assistant", id: stepKey, text: text(data.messageDelta), done: false, at });
        break;
      }
      case "message.completed": {
        const message = data.message === null ? "" : text(data.message);
        const item = find("assistant", stepKey);
        if (item) {
          Object.assign(item, { text: message, done: true });
          // A later message in the same step starts a new block.
          byId.delete(`assistant:${stepKey}`);
          if (!message) items.splice(items.indexOf(item), 1);
        } else if (message) {
          items.push({ kind: "assistant", id: `${stepKey}:${index}`, text: message, done: true, at });
        }
        break;
      }
      case "actions.requested": {
        const actions = Array.isArray(data.actions) ? data.actions : [];
        for (const raw of actions) {
          const action = record(raw);
          const callId = text(action.callId);
          if (!callId || find("tool", callId) || find("subagent", callId)) continue;
          if (action.kind === "subagent-call" || action.kind === "remote-agent-call") {
            add({ kind: "subagent", id: callId, name: text(action.name), done: false });
          } else {
            const name = action.kind === "load-skill" ? `load skill ${text(record(action.input).name)}`.trim() : text(action.toolName);
            add({ kind: "tool", id: callId, name, input: action.input, status: "running", startedAt: at });
          }
        }
        break;
      }
      case "action.result": {
        const result = record(data.result);
        const callId = text(result.callId);
        const tool = find("tool", callId);
        const status = data.status === "failed" || data.status === "rejected" ? data.status : "completed";
        if (tool) {
          Object.assign(tool, {
            output: result.output,
            status: result.isError && status === "completed" ? "failed" : status,
            error: text(record(data.error).message) || undefined,
            endedAt: at,
          });
        }
        const subagent = find("subagent", callId);
        if (subagent) Object.assign(subagent, { output: typeof result.output === "string" ? result.output : JSON.stringify(result.output), done: true });
        break;
      }
      case "subagent.called": {
        const callId = text(data.callId);
        const item = find("subagent", callId);
        if (item) item.childSessionId = text(data.childSessionId);
        else add({ kind: "subagent", id: callId, name: text(data.name), childSessionId: text(data.childSessionId), done: false });
        break;
      }
      case "input.requested": {
        const requests = Array.isArray(data.requests) ? data.requests : [];
        for (const raw of requests) {
          const request = record(raw);
          const options = (Array.isArray(request.options) ? request.options : []).map((option) => {
            const value = record(option);
            return { id: text(value.id), label: text(value.label), style: text(value.style) || undefined };
          });
          add({
            kind: "input",
            id: text(request.requestId),
            prompt: text(request.prompt),
            toolName: text(record(request.action).toolName) || undefined,
            options,
          });
        }
        break;
      }
      case "input.resolved": {
        const resolutions = Array.isArray(data.resolutions) ? data.resolutions : [];
        for (const raw of resolutions) {
          const resolution = record(raw);
          const item = find("input", text(resolution.requestId));
          if (item) item.outcome = text(resolution.outcome);
        }
        break;
      }
      case "authorization.required": {
        const id = text(data.attemptId) || `${text(data.name)}-${index}`;
        add({
          kind: "authorization",
          id,
          name: text(data.name),
          description: text(data.description),
          url: text(record(data.authorization).url) || undefined,
        });
        break;
      }
      case "authorization.completed": {
        for (let cursor = items.length - 1; cursor >= 0; cursor -= 1) {
          const candidate = items[cursor]!;
          if (candidate.kind === "authorization" && candidate.name === text(data.name) && !candidate.outcome) {
            candidate.outcome = text(data.outcome);
            break;
          }
        }
        break;
      }
      case "step.completed": {
        const usage = record(data.usage);
        const total = turnUsage.get(turnId);
        if (total) {
          total.inputTokens += number(usage.inputTokens);
          total.outputTokens += number(usage.outputTokens);
          total.costUsd += number(usage.costUsd);
        }
        break;
      }
      case "step.failed":
      case "session.failed":
        add({ kind: "error", id: event.meta?.id ?? `error-${index}`, code: text(data.code), message: text(data.message) });
        break;
      case "turn.failed":
      case "turn.completed":
      case "turn.cancelled": {
        if (event.type === "turn.failed") {
          add({ kind: "error", id: event.meta?.id ?? `error-${index}`, code: text(data.code), message: text(data.message) });
        }
        // An interrupted assistant block is final once its turn ends.
        for (const item of items) if (item.kind === "assistant" && item.id.startsWith(`${turnId}:`)) item.done = true;
        for (const item of items) if (item.kind === "tool" && item.status === "running" && event.type !== "turn.completed") item.status = "failed";
        add({
          kind: "turn",
          id: turnId || `turn-${index}`,
          status: event.type === "turn.completed" ? "completed" : event.type === "turn.failed" ? "failed" : "cancelled",
          usage: turnUsage.get(turnId) ?? { inputTokens: 0, outputTokens: 0, costUsd: 0 },
          startedAt: turnStart.get(turnId),
          endedAt: at,
        });
        break;
      }
    }
  });

  return items;
}

/** Where the session stands after the events seen so far. */
export function sessionStatus(events: readonly EveEvent[]): SessionStatus {
  let status: SessionStatus = "starting";
  let pendingInput = 0;
  for (const event of events) {
    switch (event.type) {
      case "turn.started":
        status = "running";
        break;
      case "input.requested":
        pendingInput += Array.isArray(event.data?.requests) ? event.data.requests.length : 1;
        break;
      case "input.resolved":
        pendingInput = Math.max(0, pendingInput - (Array.isArray(event.data?.resolutions) ? event.data.resolutions.length : 1));
        status = "running";
        break;
      case "session.waiting":
        status = pendingInput > 0 ? "input" : "waiting";
        break;
      case "session.failed":
        status = "failed";
        break;
      case "session.completed":
        status = "completed";
        break;
    }
  }
  return status;
}
