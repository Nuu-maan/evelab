#!/usr/bin/env node
/**
 * A stand-in for the `eve` CLI in the end to end suite. `dev` serves the parts
 * of the eve HTTP session API EveLab uses, emitting events in eve's stream
 * format; `deploy` and `link` print what a successful run prints. Nothing here
 * calls a model.
 */
import { createServer } from "node:http";
import { basename } from "node:path";

const [command, ...args] = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

if (command === "deploy") {
  const project = flag("project", basename(process.cwd()));
  console.log("Installing dependencies...");
  console.log(`Deploying ${project} to production`);
  console.log(`Production: https://${project}.vercel.app`);
  process.exit(0);
}

if (command === "link") {
  console.log(`Linked to ${flag("project", basename(process.cwd()))}`);
  process.exit(0);
}

if (command !== "dev") {
  console.error(`fake-eve: unsupported command ${command}`);
  process.exit(2);
}

const port = Number(flag("port", "2000"));
const host = flag("host", "127.0.0.1");
const sessions = new Map();
let eventCounter = 0;
let sessionCounter = 0;

function emit(session, type, data = {}) {
  eventCounter += 1;
  const event = {
    type,
    data,
    meta: { id: `evt_${String(eventCounter).padStart(10, "0")}`, at: new Date().toISOString() },
  };
  session.events.push(event);
  for (const listener of session.listeners) listener(event);
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTurn(session, message) {
  const turnId = `turn_${session.turns++}`;
  const step = { sequence: 0, stepIndex: 0, turnId };
  session.cancelled = false;
  emit(session, "turn.started", { sequence: 0, turnId });
  emit(session, "message.received", { message, sequence: 0, turnId });
  emit(session, "step.started", { ...step, modelId: "openai/gpt-5.6-luna-fast" });
  await pause(40);

  if (message.includes("slow")) {
    for (let index = 0; index < 60; index += 1) {
      if (session.cancelled) return;
      emit(session, "message.appended", { ...step, messageDelta: `word${index} ` });
      await pause(250);
    }
  }

  if (message.includes("approve")) {
    const action = { callId: "call_delete", input: { path: "notes.txt" }, kind: "tool-call", toolName: "delete_file" };
    emit(session, "actions.requested", { ...step, actions: [action] });
    emit(session, "input.requested", {
      ...step,
      requests: [
        {
          action,
          kind: "tool-approval",
          prompt: "Allow delete_file on notes.txt?",
          requestId: "req_delete",
          options: [
            { id: "approve", label: "Approve", style: "primary" },
            { id: "deny", label: "Deny", style: "danger" },
          ],
        },
      ],
    });
    session.pendingApproval = { step, action };
    emit(session, "session.waiting", { continuationToken: session.id, wait: "next-user-message" });
    return;
  }

  const action = { callId: `call_${turnId}`, input: { query: message }, kind: "tool-call", toolName: "search_docs" };
  emit(session, "actions.requested", { ...step, actions: [action] });
  await pause(40);
  emit(session, "action.result", {
    ...step,
    status: "completed",
    result: { callId: action.callId, kind: "tool-result", output: { hits: 2 }, toolName: "search_docs" },
  });
  await finish(session, step, `You asked: ${message}`);
}

async function finish(session, step, text) {
  for (const part of text.match(/.{1,6}/g) ?? []) {
    emit(session, "message.appended", { ...step, messageDelta: part });
    await pause(15);
  }
  emit(session, "message.completed", { ...step, finishReason: "stop", message: text });
  emit(session, "step.completed", {
    ...step,
    finishReason: "stop",
    usage: { inputTokens: 120, outputTokens: 18, costUsd: 0.0004 },
  });
  emit(session, "turn.completed", { sequence: 0, turnId: step.turnId });
  emit(session, "session.waiting", { continuationToken: session.id, wait: "next-user-message" });
}

async function resolveApproval(session, responses) {
  const pending = session.pendingApproval;
  if (!pending) return;
  session.pendingApproval = undefined;
  const response = responses.find((entry) => entry.requestId === "req_delete");
  const approved = response?.optionId === "approve";
  emit(session, "input.resolved", {
    ...pending.step,
    resolutions: [{ kind: "tool-approval", outcome: approved ? "approved" : "denied", requestId: "req_delete", response }],
  });
  emit(session, "action.result", {
    ...pending.step,
    status: approved ? "completed" : "rejected",
    result: { callId: pending.action.callId, kind: "tool-result", output: approved ? { deleted: true } : "Denied", toolName: "delete_file" },
  });
  await finish(session, pending.step, approved ? "Deleted notes.txt." : "Left notes.txt alone.");
}

function readBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function newSession() {
  sessionCounter += 1;
  const session = { id: `wrun_fake${sessionCounter}`, events: [], listeners: new Set(), turns: 0 };
  sessions.set(session.id, session);
  emit(session, "session.started", { runtime: { agentId: basename(process.cwd()), eveVersion: "0.54.3" } });
  return session;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/eve/v1/health") return json(response, 200, { ok: true, status: "ready", workflowId: "wf_fake" });
  if (url.pathname === "/eve/v1/info") return json(response, 200, { name: basename(process.cwd()) });

  if (request.method === "POST" && url.pathname === "/eve/v1/session") {
    const body = await readBody(request);
    const session = newSession();
    void runTurn(session, String(body.message ?? ""));
    response.setHeader("x-eve-session-id", session.id);
    return json(response, 202, { sessionId: session.id });
  }

  if (request.method === "POST" && parts[0] === "eve" && parts[2] === "dev" && parts[3] === "schedules") {
    const session = newSession();
    void runTurn(session, `Scheduled run of ${decodeURIComponent(parts[4] ?? "")}`);
    return json(response, 200, { scheduleId: decodeURIComponent(parts[4] ?? ""), sessionIds: [session.id] });
  }

  const session = parts[2] === "session" ? sessions.get(parts[3] ?? "") : undefined;
  if (!session) return json(response, 404, { error: "not_found" });

  if (request.method === "GET" && parts[4] === "stream") {
    response.writeHead(200, { "content-type": "application/x-ndjson", "x-eve-stream-version": "25" });
    const start = Number(url.searchParams.get("startIndex") ?? 0);
    for (const event of session.events.slice(start)) response.write(`${JSON.stringify(event)}\n`);
    const listener = (event) => response.write(`${JSON.stringify(event)}\n`);
    session.listeners.add(listener);
    request.on("close", () => session.listeners.delete(listener));
    return;
  }

  if (request.method === "POST" && parts[4] === "cancel") {
    session.cancelled = true;
    const turnId = `turn_${Math.max(0, session.turns - 1)}`;
    emit(session, "turn.cancelled", { sequence: 0, turnId });
    emit(session, "session.waiting", { continuationToken: session.id, wait: "next-user-message" });
    return json(response, 202, { ok: true, sessionId: session.id, status: "accepted" });
  }

  if (request.method === "POST" && parts.length === 4) {
    const body = await readBody(request);
    if (Array.isArray(body.inputResponses)) void resolveApproval(session, body.inputResponses);
    else void runTurn(session, String(body.message ?? ""));
    return json(response, 202, { ok: true, sessionId: session.id, deliveryId: `dlv_${eventCounter}` });
  }

  return json(response, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  console.log("☰eve  v0.54.3 (fake)");
  console.log(`[DEV] server listening at http://${host}:${port}/`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
