"use client";

import { durationMs, type TimelineItem } from "@/lib/run-timeline";
import { Button } from "@/components/ui/button";

function formatDuration(ms: number | undefined): string | undefined {
  if (ms === undefined) return undefined;
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function formatJson(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const TOOL_STATUS: Record<Extract<TimelineItem, { kind: "tool" }>["status"], string> = {
  running: "Running",
  completed: "Done",
  failed: "Failed",
  rejected: "Rejected",
};

/**
 * The run, in order. Everything shown is text from eve's stream: tool inputs
 * and outputs are model and tool data, so they are rendered as text only.
 */
export function Timeline({
  items,
  onRespond,
  responding,
}: {
  items: TimelineItem[];
  onRespond: (requestId: string, optionId: string) => void;
  responding: boolean;
}) {
  return (
    <ol className="timeline" aria-label="Run timeline">
      {items.map((item) => {
        switch (item.kind) {
          case "user":
            return (
              <li key={`user-${item.id}`} className="timeline-item" data-kind="user">
                <p className="timeline-label">You</p>
                <p className="timeline-text">{item.text}</p>
              </li>
            );
          case "assistant":
            return (
              <li key={`assistant-${item.id}`} className="timeline-item" data-kind="assistant">
                <p className="timeline-label">Agent</p>
                <p className="timeline-text" aria-busy={!item.done}>
                  {item.text}
                </p>
              </li>
            );
          case "reasoning":
            return (
              <li key={`reasoning-${item.id}`} className="timeline-item" data-kind="reasoning">
                <details>
                  <summary className="timeline-label">Reasoning</summary>
                  <p className="timeline-text hint">{item.text}</p>
                </details>
              </li>
            );
          case "tool":
            return (
              <li key={`tool-${item.id}`} className="timeline-item" data-kind="tool" data-status={item.status}>
                <details>
                  <summary className="timeline-summary">
                    <span className="mono">{item.name}</span>
                    <span className="status" data-tone={item.status === "completed" ? "ready" : item.status === "running" ? "modified" : "error"}>
                      {TOOL_STATUS[item.status]}
                    </span>
                    {formatDuration(durationMs(item.startedAt, item.endedAt)) && (
                      <span className="hint tabular-nums">{formatDuration(durationMs(item.startedAt, item.endedAt))}</span>
                    )}
                  </summary>
                  <div className="timeline-io">
                    <p className="timeline-label">Input</p>
                    <pre className="code mono">{formatJson(item.input)}</pre>
                    {item.output !== undefined && (
                      <>
                        <p className="timeline-label">Output</p>
                        <pre className="code mono">{formatJson(item.output)}</pre>
                      </>
                    )}
                    {item.error && <p className="form-error">{item.error}</p>}
                  </div>
                </details>
              </li>
            );
          case "subagent":
            return (
              <li key={`subagent-${item.id}`} className="timeline-item" data-kind="subagent">
                <details>
                  <summary className="timeline-summary">
                    <span>
                      Delegated to <span className="mono">{item.name}</span>
                    </span>
                    <span className="status" data-tone={item.done ? "ready" : "modified"}>
                      {item.done ? "Done" : "Working"}
                    </span>
                  </summary>
                  {item.output && <pre className="code mono">{item.output}</pre>}
                </details>
              </li>
            );
          case "input":
            return (
              <li key={`input-${item.id}`} className="timeline-item" data-kind="input">
                <p className="timeline-label">{item.toolName ? `Approval for ${item.toolName}` : "Question"}</p>
                <p className="timeline-text">{item.prompt}</p>
                {item.outcome ? (
                  <p className="hint">Answered: {item.outcome}</p>
                ) : (
                  <div className="row">
                    {item.options.map((option) => (
                      <Button
                        key={option.id}
                        size="sm"
                        variant={option.style === "danger" ? "outline" : "default"}
                        disabled={responding}
                        onClick={() => onRespond(item.id, option.id)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            );
          case "authorization":
            return (
              <li key={`auth-${item.id}`} className="timeline-item" data-kind="input">
                <p className="timeline-label">{item.name} needs authorization</p>
                <p className="timeline-text">{item.description}</p>
                {item.outcome ? (
                  <p className="hint">Authorization {item.outcome}</p>
                ) : (
                  item.url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={item.url} target="_blank" rel="noreferrer noopener">
                        Authorize
                      </a>
                    </Button>
                  )
                )}
              </li>
            );
          case "error":
            return (
              <li key={`error-${item.id}`} className="timeline-item" data-kind="error" role="alert">
                <p className="timeline-label">{item.code || "Error"}</p>
                <p className="timeline-text">{item.message}</p>
              </li>
            );
          case "turn": {
            const duration = formatDuration(durationMs(item.startedAt, item.endedAt));
            const parts = [
              item.status === "completed" ? "Turn complete" : item.status === "failed" ? "Turn failed" : "Cancelled",
              duration,
              item.usage.inputTokens || item.usage.outputTokens
                ? `${item.usage.inputTokens} in, ${item.usage.outputTokens} out`
                : undefined,
              item.usage.costUsd ? `$${item.usage.costUsd.toFixed(4)}` : undefined,
            ].filter(Boolean);
            return (
              <li key={`turn-${item.id}`} className="timeline-turn" data-status={item.status}>
                {parts.join(" · ")}
              </li>
            );
          }
        }
      })}
    </ol>
  );
}
