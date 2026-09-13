"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Timeline } from "@/components/runs/timeline";
import { Shortcut } from "@/components/shortcut";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildTimeline, sessionStatus, type EveEvent } from "@/lib/run-timeline";
import type { RunRecord } from "@/lib/runs";
import type { RuntimeSnapshot } from "@/lib/runtime";
import "@/app/runs.css";

const STATUS_LABEL: Record<RuntimeSnapshot["status"], string> = {
  stopped: "Stopped",
  installing: "Installing dependencies",
  starting: "Starting",
  running: "Running",
  failed: "Failed",
};

async function post(url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, data };
}

export function RunConsole({
  projectId,
  initialRuntime,
  allowed,
  runs,
  sessionId: initialSessionId,
  initialEvents,
}: {
  projectId: string;
  initialRuntime: RuntimeSnapshot;
  allowed: boolean;
  runs: RunRecord[];
  sessionId?: string;
  initialEvents: EveEvent[];
}) {
  const router = useRouter();
  const api = `/api/projects/${projectId}`;
  const [runtime, setRuntime] = useState(initialRuntime);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [events, setEvents] = useState<EveEvent[]>(initialEvents);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const timeline = useMemo(() => buildTimeline(events), [events]);
  const status = sessionId ? sessionStatus(events) : undefined;
  const live = runtime.status === "running";
  const busy = status === "running" || status === "starting";

  // Follow the session's stream for as long as it is open, resuming from the last event.
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    let stopped = false;

    const follow = async () => {
      for (let attempt = 0; attempt < 30 && !stopped; attempt += 1) {
        try {
          const response = await fetch(`${api}/sessions/${sessionId}/stream?startIndex=${eventsRef.current.length}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok || !response.body) return;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            const parsed = lines.flatMap((line) => {
              try {
                return line.trim() ? [JSON.parse(line) as EveEvent] : [];
              } catch {
                return [];
              }
            });
            if (parsed.length > 0) {
              setEvents((current) => {
                const seen = new Set(current.map((event) => event.meta?.id).filter(Boolean));
                const fresh = parsed.filter((event) => !event.meta?.id || !seen.has(event.meta.id));
                return fresh.length > 0 ? [...current, ...fresh] : current;
              });
            }
          }
          // A replayed stream ends on purpose; a live one ends only when the connection drops.
          if (response.headers.get("x-evelab-live") !== "true") return;
        } catch {
          if (controller.signal.aborted) return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };
    void follow();
    return () => {
      stopped = true;
      controller.abort();
    };
  }, [api, sessionId]);

  const changeRuntime = async (action: "start" | "stop") => {
    setRuntimeBusy(true);
    setError(undefined);
    if (action === "start") setRuntime((current) => ({ ...current, status: "starting" }));
    const { data } = await post(`${api}/runtime`, { action });
    setRuntimeBusy(false);
    if (data.runtime) setRuntime(data.runtime as RuntimeSnapshot);
  };

  const openSession = useCallback(
    (id: string | undefined) => {
      setSessionId(id);
      setEvents([]);
      const url = id ? `?session=${encodeURIComponent(id)}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    },
    [],
  );

  const send = async () => {
    const text = message.trim();
    if (!text || sending || !live) return;
    setSending(true);
    setError(undefined);
    const result = sessionId
      ? await post(`${api}/sessions/${sessionId}`, { message: text })
      : await post(`${api}/sessions`, { message: text });
    setSending(false);
    if (!result.ok) {
      setError(typeof result.data.error === "string" ? result.data.error : "The run could not start.");
      return;
    }
    setMessage("");
    if (!sessionId && typeof result.data.sessionId === "string") {
      openSession(result.data.sessionId);
      router.refresh();
    }
  };

  const respond = async (requestId: string, optionId: string) => {
    if (!sessionId) return;
    setSending(true);
    const result = await post(`${api}/sessions/${sessionId}`, { inputResponses: [{ requestId, optionId }] });
    setSending(false);
    if (!result.ok) setError(typeof result.data.error === "string" ? result.data.error : "That answer was not accepted.");
  };

  const cancel = async () => {
    if (!sessionId) return;
    const result = await post(`${api}/sessions/${sessionId}/cancel`);
    if (!result.ok) setError(typeof result.data.error === "string" ? result.data.error : "Could not cancel.");
  };

  return (
    <div className="runs-layout">
      <aside className="runs-history" aria-label="Run history">
        <div className="runtime-card" data-status={runtime.status}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <p className="timeline-label">Dev server</p>
              <p className="runtime-status" role="status">
                <span className="status" data-tone={live ? "ready" : runtime.status === "failed" ? "error" : "modified"}>
                  {STATUS_LABEL[runtime.status]}
                </span>
              </p>
            </div>
            {live ? (
              <Button size="sm" variant="outline" disabled={runtimeBusy} onClick={() => void changeRuntime("stop")}>
                Stop
              </Button>
            ) : (
              <Button size="sm" disabled={runtimeBusy || !allowed} onClick={() => void changeRuntime("start")}>
                Start dev server
              </Button>
            )}
          </div>
          <p className="hint">
            {!allowed
              ? "Runs need a Vercel deployment when EveLab is shared."
              : live
                ? `eve dev at ${runtime.url}`
                : runtime.message ?? "Runs eve dev --no-ui in the project directory."}
          </p>
          {runtime.log.length > 0 && (
            <details>
              <summary className="hint">Log</summary>
              <pre className="code mono runtime-log">{runtime.log.slice(-40).join("\n")}</pre>
            </details>
          )}
        </div>

        <div className="row" style={{ justifyContent: "space-between" }}>
          <p className="timeline-label">Runs</p>
          <Button size="sm" variant="ghost" onClick={() => openSession(undefined)}>
            New run
          </Button>
        </div>
        {runs.length === 0 ? (
          <p className="hint">Runs you start appear here, and stay readable after the dev server stops.</p>
        ) : (
          <ul className="runs-list">
            {runs.map((run) => (
              <li key={run.sessionId}>
                <Link
                  className="runs-link"
                  href={`?session=${encodeURIComponent(run.sessionId)}`}
                  aria-current={run.sessionId === sessionId ? "page" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    openSession(run.sessionId);
                  }}
                >
                  <span className="truncate">{run.title}</span>
                  <span className="hint tabular-nums">
                    {new Date(run.startedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="runs-main" aria-label="Run">
        <div className="runs-scroll">
          {timeline.length === 0 ? (
            <p className="hint runs-empty">
              {sessionId
                ? "Waiting for events."
                : live
                  ? "Send a message to start a session. Tool calls, approvals and usage appear as eve streams them."
                  : "Start the dev server, then send a message."}
            </p>
          ) : (
            <Timeline items={timeline} onRespond={(requestId, optionId) => void respond(requestId, optionId)} responding={sending} />
          )}
        </div>

        <form
          className="runs-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Textarea
            aria-label="Message"
            placeholder={live ? "Message the agent" : "Start the dev server to send a message"}
            value={message}
            rows={3}
            disabled={!live}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="hint">{status ? `Session ${status}` : "New session"}</span>
            <div className="row">
              {busy && (
                <Button type="button" variant="outline" onClick={() => void cancel()}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={!live || sending || !message.trim()}>
                Send
              </Button>
              <Shortcut keys="Enter" />
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
