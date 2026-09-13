import { describe, expect, it } from "vitest";
import { recentDays, summarizeRuns, type RecordedRun } from "../src/lib/observability";

const at = (seconds: number) => new Date(Date.UTC(2026, 8, 13, 10, 0, seconds)).toISOString();
const ev = (type: string, data: Record<string, unknown>, second: number, id: string) => ({ type, data, meta: { id, at: at(second) } });
const step = { turnId: "turn_0", stepIndex: 0, sequence: 0 };

function run(sessionId: string, failTool: boolean): RecordedRun {
  return {
    sessionId,
    title: "Find docs",
    startedAt: at(0),
    events: [
      ev("turn.started", { turnId: "turn_0" }, 0, `${sessionId}-1`),
      ev("step.started", { ...step, modelId: "anthropic/claude-sonnet-5" }, 0, `${sessionId}-2`),
      ev("actions.requested", { ...step, actions: [{ callId: "c1", kind: "tool-call", toolName: "search_docs", input: {} }] }, 1, `${sessionId}-3`),
      ev("action.result", { ...step, status: failTool ? "failed" : "completed", result: { callId: "c1", kind: "tool-result", toolName: "search_docs", output: {} } }, 3, `${sessionId}-4`),
      ev("step.completed", { ...step, usage: { inputTokens: 100, outputTokens: 20, costUsd: 0.002 } }, 4, `${sessionId}-5`),
      failTool
        ? ev("turn.failed", { turnId: "turn_0", code: "TOOL_FAILED", message: "search_docs timed out" }, 6, `${sessionId}-6`)
        : ev("turn.completed", { turnId: "turn_0" }, 5, `${sessionId}-6`),
    ],
  };
}

describe("summarizeRuns", () => {
  it("adds up usage, latency, tool outcomes, models and errors across runs", () => {
    const summary = summarizeRuns([run("a", false), run("b", true)], { days: 3, now: new Date(at(0)) });

    expect(summary).toMatchObject({ runs: 2, turns: 2, failedTurns: 1, inputTokens: 200, outputTokens: 40 });
    expect(summary.costUsd).toBeCloseTo(0.004);
    expect(summary.turnP50).toBe(5000);
    expect(summary.turnP95).toBe(6000);
    expect(summary.tools).toEqual([{ name: "search_docs", calls: 2, failures: 1, medianMs: 2000 }]);
    expect(summary.models).toEqual([{ id: "anthropic/claude-sonnet-5", steps: 2 }]);
    expect(summary.errors).toEqual([expect.objectContaining({ code: "TOOL_FAILED", count: 1, sessionId: "b" })]);
    expect(summary.days.map((day) => day.day)).toEqual(["2026-09-11", "2026-09-12", "2026-09-13"]);
    expect(summary.days[2]).toMatchObject({ runs: 2, turns: 2, tokens: 240 });
  });

  it("returns an empty, gap-free window when nothing has run", () => {
    const summary = summarizeRuns([], { days: 7, now: new Date(at(0)) });
    expect(summary.days).toHaveLength(7);
    expect(summary.turnP50).toBeUndefined();
    expect(recentDays(2, new Date(at(0)))).toEqual(["2026-09-12", "2026-09-13"]);
  });
});
