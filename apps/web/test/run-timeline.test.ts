import { describe, expect, it } from "vitest";
import { buildTimeline, sessionStatus, type EveEvent } from "../src/lib/run-timeline";

let clock = 0;
function event(type: string, data: Record<string, unknown> = {}): EveEvent {
  clock += 100;
  return { type, data, meta: { id: `evt_${clock}`, at: new Date(Date.UTC(2026, 8, 13, 0, 0, 0, clock)).toISOString() } };
}

const step = { turnId: "turn_0", stepIndex: 0, sequence: 0 };

describe("buildTimeline", () => {
  it("assembles a turn: message, tool call with its result, streamed reply and usage", () => {
    const events = [
      event("session.started"),
      event("turn.started", { turnId: "turn_0", sequence: 0 }),
      event("message.received", { message: "Find the refund policy", turnId: "turn_0", sequence: 0 }),
      event("actions.requested", { ...step, actions: [{ callId: "c1", kind: "tool-call", toolName: "search_docs", input: { q: "refund" } }] }),
      event("action.result", { ...step, status: "completed", result: { callId: "c1", kind: "tool-result", toolName: "search_docs", output: { hits: 2 } } }),
      event("message.appended", { ...step, messageDelta: "Refunds within " }),
      event("message.appended", { ...step, messageDelta: "30 days" }),
      event("message.completed", { ...step, finishReason: "stop", message: "Refunds within 30 days." }),
      event("step.completed", { ...step, finishReason: "stop", usage: { inputTokens: 100, outputTokens: 10, costUsd: 0.001 } }),
      event("turn.completed", { turnId: "turn_0", sequence: 0 }),
      event("session.waiting", { continuationToken: "s", wait: "next-user-message" }),
    ];
    const timeline = buildTimeline(events);

    expect(timeline.map((item) => item.kind)).toEqual(["user", "tool", "assistant", "turn"]);
    expect(timeline[1]).toMatchObject({ name: "search_docs", status: "completed", output: { hits: 2 } });
    expect(timeline[2]).toMatchObject({ text: "Refunds within 30 days.", done: true });
    expect(timeline[3]).toMatchObject({ status: "completed", usage: { inputTokens: 100, outputTokens: 10, costUsd: 0.001 } });
    expect(sessionStatus(events)).toBe("waiting");
  });

  it("shows a pending approval and its outcome", () => {
    const events = [
      event("turn.started", { turnId: "turn_0" }),
      event("input.requested", {
        ...step,
        requests: [
          {
            requestId: "r1",
            kind: "tool-approval",
            prompt: "Allow delete?",
            action: { callId: "c1", kind: "tool-call", toolName: "delete_file", input: {} },
            options: [{ id: "approve", label: "Approve" }],
          },
        ],
      }),
      event("session.waiting", {}),
    ];
    expect(sessionStatus(events)).toBe("input");
    const resolved = [...events, event("input.resolved", { ...step, resolutions: [{ requestId: "r1", outcome: "approved", kind: "tool-approval" }] })];
    expect(buildTimeline(resolved)).toContainEqual(expect.objectContaining({ kind: "input", toolName: "delete_file", outcome: "approved" }));
  });

  it("keeps a cancelled turn's partial text and marks it final", () => {
    const timeline = buildTimeline([
      event("turn.started", { turnId: "turn_0" }),
      event("message.appended", { ...step, messageDelta: "Half an ans" }),
      event("turn.cancelled", { turnId: "turn_0" }),
    ]);
    expect(timeline).toEqual([
      expect.objectContaining({ kind: "assistant", text: "Half an ans", done: true }),
      expect.objectContaining({ kind: "turn", status: "cancelled" }),
    ]);
  });

  it("reports a failed turn as an error, and drops an intentionally empty reply", () => {
    const timeline = buildTimeline([
      event("turn.started", { turnId: "turn_0" }),
      event("message.completed", { ...step, message: null, finishReason: "stop" }),
      event("turn.failed", { turnId: "turn_0", code: "MODEL_CALL_FAILED", message: "No credentials" }),
    ]);
    expect(timeline.map((item) => item.kind)).toEqual(["error", "turn"]);
    expect(timeline[0]).toMatchObject({ code: "MODEL_CALL_FAILED" });
  });
});
