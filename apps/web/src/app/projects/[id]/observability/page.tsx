import Link from "next/link";
import { IconArrowUpRight, IconChartActivity } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { Reveal } from "@/components/motion";
import { BarChart } from "@/components/observability/bar-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readDeployState } from "@/lib/deploy";
import { summarizeRuns, type RecordedRun } from "@/lib/observability";
import { listRuns, readRunEvents } from "@/lib/runs";
import "@/app/observability.css";

export const dynamic = "force-dynamic";

const DAYS = 14;

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function usd(value: number): string {
  if (value === 0) return "$0";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

function ms(value: number | undefined): string {
  if (value === undefined) return "No data";
  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
}

function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default async function ObservabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [records, deploy] = await Promise.all([listRuns(id), readDeployState(id)]);
  const runs: RecordedRun[] = await Promise.all(
    records.map(async (record) => ({
      sessionId: record.sessionId,
      title: record.title,
      startedAt: record.startedAt,
      events: await readRunEvents(id, record.sessionId),
    })),
  );
  const summary = summarizeRuns(runs, { days: DAYS });
  const failureRate = summary.turns > 0 ? summary.failedTurns / summary.turns : 0;
  const deployed = deploy.deployments.find((deployment) => deployment.status === "ready");
  const vercelProject = deploy.settings.project ?? id;
  const vercelBase = deploy.settings.team ? `https://vercel.com/${deploy.settings.team}/${vercelProject}` : undefined;

  const stats = [
    { label: "Runs", value: compact(summary.runs), detail: `${summary.turns} turns` },
    {
      label: "Failed turns",
      value: summary.turns > 0 ? `${Math.round(failureRate * 100)}%` : "0%",
      detail: `${summary.failedTurns} of ${summary.turns}`,
    },
    {
      label: "Tokens",
      value: compact(summary.inputTokens + summary.outputTokens),
      detail: `${compact(summary.inputTokens)} in, ${compact(summary.outputTokens)} out`,
    },
    { label: "Cost", value: usd(summary.costUsd), detail: "As reported by AI Gateway" },
    { label: "Turn latency", value: ms(summary.turnP50), detail: `p95 ${ms(summary.turnP95)}` },
  ];

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Observability</h1>
            <p className="page-description">
              What your agent did and what it cost, from the events eve streamed for every run started in EveLab. Deployed
              sessions live in Vercel Observability, next to runtime logs and traces.
            </p>
          </div>
          <div className="page-actions">
            {vercelBase ? (
              <Button asChild variant="outline">
                <a href={`${vercelBase}/observability`} target="_blank" rel="noreferrer noopener">
                  Vercel Observability
                  <Icon icon={IconArrowUpRight} size={14} />
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/projects/${id}/deployments`}>Set up deployments</Link>
              </Button>
            )}
          </div>
        </header>
      </Reveal>

      {summary.runs === 0 ? (
        <Reveal delay={0.06}>
          <EmptyState
            icon={IconChartActivity}
            title="Nothing to measure yet."
            action={
              <Button asChild variant="outline">
                <Link href={`/projects/${id}/runs`}>Start a run</Link>
              </Button>
            }
          >
            Runs you start on the Runs page are recorded, and their usage, latency, tool calls and errors appear here.
          </EmptyState>
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.04}>
            <section className="stat-row" aria-label="Last runs at a glance">
              {stats.map((stat) => (
                <div className="stat-tile" key={stat.label}>
                  <p className="stat-tile-label">{stat.label}</p>
                  <p className="stat-tile-value">{stat.value}</p>
                  <p className="stat-tile-detail">{stat.detail}</p>
                </div>
              ))}
            </section>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="grid-2">
              <Card>
                <CardHeader>
                  <CardTitle>Turns per day</CardTitle>
                  <CardDescription>Last {DAYS} days, UTC</CardDescription>
                </CardHeader>
                <CardContent>
                  <BarChart
                    label="Turns per day"
                    format={(value) => compact(value)}
                    data={summary.days.map((day) => ({ key: day.day, label: dayLabel(day.day), value: day.turns }))}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Cost per day</CardTitle>
                  <CardDescription>Last {DAYS} days, UTC</CardDescription>
                </CardHeader>
                <CardContent>
                  <BarChart
                    label="Cost per day"
                    format={usd}
                    data={summary.days.map((day) => ({ key: day.day, label: dayLabel(day.day), value: day.costUsd }))}
                  />
                </CardContent>
              </Card>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="grid-2">
              <Card>
                <CardHeader>
                  <CardTitle>Tools</CardTitle>
                  <CardDescription>Calls, failures and median duration</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.tools.length === 0 ? (
                    <p className="hint">No tool calls yet.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Tool</th>
                          <th scope="col">Calls</th>
                          <th scope="col">Failed</th>
                          <th scope="col">Median</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.tools.map((tool) => (
                          <tr key={tool.name}>
                            <td className="mono">{tool.name}</td>
                            <td className="tabular-nums">{tool.calls}</td>
                            <td className="tabular-nums" data-tone={tool.failures > 0 ? "error" : undefined}>
                              {tool.failures}
                            </td>
                            <td className="tabular-nums">{ms(tool.medianMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Models</CardTitle>
                  <CardDescription>Model steps, through AI Gateway</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.models.length === 0 ? (
                    <p className="hint">No model steps recorded.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Model</th>
                          <th scope="col">Steps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.models.map((model) => (
                          <tr key={model.id}>
                            <td className="mono">{model.id}</td>
                            <td className="tabular-nums">{model.steps}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <Card>
              <CardHeader>
                <CardTitle>Errors</CardTitle>
                <CardDescription>Failed steps and turns, most frequent first</CardDescription>
              </CardHeader>
              <CardContent>
                {summary.errors.length === 0 ? (
                  <p className="hint">No errors in recorded runs.</p>
                ) : (
                  <ul className="list" aria-label="Errors">
                    {summary.errors.map((error) => (
                      <li className="list-item" key={`${error.code}-${error.message}`}>
                        <div className="min-w-0">
                          <p className="mono">{error.code}</p>
                          <p className="list-item-detail">{error.message}</p>
                        </div>
                        <div className="row">
                          <span className="hint tabular-nums">{error.count}x</span>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/projects/${id}/runs?session=${encodeURIComponent(error.sessionId)}`}>Open run</Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </Reveal>
        </>
      )}

      <Reveal delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle>In production</CardTitle>
            <CardDescription>
              {deployed?.url
                ? `Deployed at ${deployed.url}. Vercel records its sessions, logs and workflow runs.`
                : "After the first deploy, Vercel records sessions, runtime logs and workflow runs for the agent."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="platform-list" aria-label="Vercel observability">
              {[
                { name: "Agent Runs", detail: "Every deployed session as a trace", path: "observability" },
                { name: "Runtime logs", detail: "Function and sandbox output", path: "logs" },
                { name: "Workflow runs", detail: "Durable steps, retries and timings", path: "workflows" },
              ].map((item) => (
                <li className="platform-item" key={item.name}>
                  <Icon icon={IconChartActivity} className="platform-icon" />
                  <div className="platform-text">
                    <p className="platform-name">{item.name}</p>
                    <p className="platform-role">{item.detail}</p>
                  </div>
                  {vercelBase ? (
                    <a
                      className="platform-docs"
                      href={`${vercelBase}/${item.path}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Open ${item.name} in Vercel`}
                    >
                      <Icon icon={IconArrowUpRight} size={14} />
                    </a>
                  ) : (
                    <span className="hint">Set the team on Deployments</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
