"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconCircle, IconCrossCircle, IconMinusCircle } from "@/components/icons";
import { Icon, type IconData } from "@/components/icon";
import { Button } from "@/components/ui/button";
import type { RuntimeSnapshot, RuntimeStep } from "@/lib/runtime";

const STATUS_LABEL: Record<RuntimeSnapshot["status"], string> = {
  stopped: "Stopped",
  installing: "Installing",
  starting: "Starting",
  running: "Ready",
  failed: "Failed",
};

const STEP_ICON: Record<RuntimeStep["status"], IconData | undefined> = {
  pending: IconCircle,
  active: undefined,
  done: IconCheck,
  failed: IconCrossCircle,
  skipped: IconMinusCircle,
};

function seconds(start?: string, end?: string, now = Date.now()): string | undefined {
  if (!start) return undefined;
  const ms = (end ? Date.parse(end) : now) - Date.parse(start);
  return ms < 0 ? undefined : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * The dev server, shown as the work it does: where it runs, each boot step with
 * its timing, and the address once it answers. Booting a sandbox takes tens of
 * seconds, and a list of steps that tick over is what makes that wait legible.
 */
export function RuntimeCard({
  runtime,
  available,
  busy,
  onStart,
  onStop,
}: {
  runtime: RuntimeSnapshot;
  available: boolean;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const booting = runtime.status === "starting" || runtime.status === "installing";
  const live = runtime.status === "running";

  useEffect(() => {
    if (!booting) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [booting]);

  const sandbox = runtime.target === "sandbox";
  const minutesLeft = runtime.expiresAt ? Math.max(0, Math.round((Date.parse(runtime.expiresAt) - now) / 60_000)) : undefined;

  return (
    <section className="runtime-card" data-status={runtime.status} aria-label="Dev server">
      <div className="runtime-head">
        <div className="runtime-title">
          <span className="runtime-target" data-target={runtime.target}>
            {sandbox ? "Vercel Sandbox" : "This machine"}
          </span>
          <span className="status" role="status" data-tone={live ? "ready" : runtime.status === "failed" ? "error" : "modified"}>
            {STATUS_LABEL[runtime.status]}
          </span>
        </div>
        {live || booting ? (
          <Button size="sm" variant="outline" disabled={busy && !booting} onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" disabled={busy || !available} onClick={onStart}>
            Start dev server
          </Button>
        )}
      </div>

      {runtime.steps.length > 0 && (
        <ol className="runtime-steps" aria-label="Boot steps">
          {runtime.steps.map((current) => (
            <li key={current.id} className="runtime-step" data-status={current.status}>
              <span className="runtime-step-icon" aria-hidden="true">
                {STEP_ICON[current.status] ? <Icon icon={STEP_ICON[current.status]!} size={14} /> : <span className="runtime-spinner" />}
              </span>
              <span className="runtime-step-label">{current.label}</span>
              {current.detail && <span className="runtime-step-detail mono">{current.detail}</span>}
              <span className="runtime-step-time tabular-nums">
                {current.status === "active" || current.status === "done" || current.status === "failed"
                  ? seconds(current.startedAt, current.endedAt, now)
                  : ""}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="hint">
        {!available
          ? "This evelab is shared. Connect Vercel Sandbox in Settings to run agents in isolation."
          : live
            ? sandbox && minutesLeft !== undefined
              ? `Serving at ${runtime.url}. The sandbox stops in about ${minutesLeft} minutes.`
              : `Serving at ${runtime.url}.`
            : runtime.status === "failed"
              ? runtime.message
              : sandbox
                ? "Boots an isolated microVM, uploads the project and runs eve dev there. Saves sync while it runs."
                : "Runs eve dev --no-ui in the project directory. Set Vercel credentials to run in a sandbox instead."}
      </p>

      {runtime.log.length > 0 && (
        <details>
          <summary className="hint">Log</summary>
          <pre className="code mono runtime-log">{runtime.log.slice(-60).join("\n")}</pre>
        </details>
      )}
    </section>
  );
}
