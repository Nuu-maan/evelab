import Link from "next/link";
import {
  IconArrowUpRight,
  IconCheckCircle,
  IconCircle,
  IconMinusCircle,
  IconRoute,
} from "@/components/icons";
import { agentPath, getCanvasGraph, skillFilePath } from "@evelab/eve-project";
import { GraphPreview } from "@/components/graph-preview";
import { Icon } from "@/components/icon";
import { KINDS, KindTile } from "@/components/kinds";
import { Reveal } from "@/components/motion";
import { Avatar } from "@/components/project-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readLayout } from "@/lib/layout";
import { modelLabel, getProject, validateProject } from "@/lib/workspace";
import "@/app/overview.css";

export const dynamic = "force-dynamic";

const PREVIEW_LIMIT = 5;

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, layout] = await Promise.all([getProject(id), readLayout(id)]);
  const issues = validateProject(project);
  const errors = issues.filter((issue) => issue.level === "error");
  const graph = getCanvasGraph(project);
  const base = `/projects/${id}`;
  const fileHref = (path: string) => `${base}/files?path=${encodeURIComponent(path)}`;
  const instructionLines = project.agent.instructions.split("\n").filter((line) => line.trim()).length;
  const root = project.root ? `${project.root}/` : "";
  const instructionsPath = project.agent.instructionsPath || agentPath(project.root, "instructions.md");
  const configPath = agentPath(project.root, "agent.ts");

  const details = [
    {
      label: "Model",
      value: <span className="mono">{modelLabel(project) || "Not set"}</span>,
      href: `${base}/agent/model`,
    },
    {
      label: "Instructions",
      value: (
        <>
          <span className="mono">{instructionsPath}</span>
          <span className="overview-detail-hint">
            {instructionLines} {instructionLines === 1 ? "line" : "lines"}
          </span>
        </>
      ),
      href: `${base}/agent/instructions`,
    },
    {
      label: "Configuration",
      value: (
        <span className="status" data-tone={errors.length > 0 ? "error" : "ready"}>
          {errors.length > 0
            ? `${errors.length} ${errors.length === 1 ? "error" : "errors"}`
            : "Valid"}
        </span>
      ),
      href: issues.length > 0 ? "#issues" : undefined,
    },
    ...(project.extensions.length > 0
      ? [
          {
            label: "Extensions",
            value: <span className="mono">{project.extensions.map((extension) => extension.package ?? extension.id).join(", ")}</span>,
            href: fileHref(project.extensions[0]!.file),
          },
        ]
      : []),
    ...(project.memory.length > 0
      ? [
          {
            label: "Memory",
            value: <span className="mono">{project.memory.map((slot) => slot.id).join(", ")}</span>,
            href: fileHref(project.memory[0]!.file),
          },
        ]
      : []),
    {
      label: "Files",
      value: <span>{project.files.length} on disk</span>,
      href: `${base}/files`,
    },
    { label: "Latest run", value: <span className="hint">Coming soon</span> },
  ];

  const columns = [
    {
      kind: "tool" as const,
      href: `${base}/tools`,
      empty: "No tools yet. Add one to let the agent act.",
      items: project.tools.map((tool) => ({
        id: tool.id,
        name: tool.id,
        detail: tool.description || tool.kind,
        path: `${root}tools/${tool.file}`,
      })),
    },
    {
      kind: "skill" as const,
      href: `${base}/skills`,
      empty: "No skills yet. Import one from GitHub.",
      items: project.skills.map((skill) => ({
        id: skill.id,
        name: skill.id,
        detail: skill.description || skill.format,
        path: skillFilePath(root, skill),
      })),
    },
    {
      kind: "subagent" as const,
      href: `${base}/subagents`,
      empty: "No subagents yet. Create one for specialised work.",
      items: project.subagents.map((subagent) => ({
        id: subagent.id,
        name: subagent.id,
        detail: subagent.description || subagent.model?.id || "Default model",
        path: subagent.kind === "local" ? `${root}subagents/${subagent.id}/agent.ts` : `${root}subagents/${subagent.id}.ts`,
      })),
    },
    {
      kind: "connection" as const,
      href: `${base}/connections`,
      empty: "No connections yet. Add an MCP server or OpenAPI service.",
      items: project.connections.map((connection) => ({
        id: connection.id,
        name: connection.id,
        detail: connection.description || connection.url || connection.spec || connection.kind,
        path: `${root}connections/${connection.file}`,
      })),
    },
  ];

  const steps: { label: string; detail: string; href?: string; state: "done" | "todo" | "unavailable" }[] = [
    {
      label: "Choose a model",
      detail: configPath,
      href: `${base}/agent/model`,
      state: project.agent.model ? "done" : "todo",
    },
    {
      label: "Write instructions",
      detail: instructionsPath,
      href: `${base}/agent/instructions`,
      state: instructionLines > 0 ? "done" : "todo",
    },
    {
      label: "Add a tool",
      detail: `${root}tools/`,
      href: `${base}/tools`,
      state: project.tools.length > 0 ? "done" : "todo",
    },
    {
      label: "Import a skill",
      detail: `${root}skills/`,
      href: `${base}/skills`,
      state: project.skills.length > 0 ? "done" : "todo",
    },
    {
      label: "Create a subagent",
      detail: `${root}subagents/`,
      href: `${base}/subagents`,
      state: project.subagents.length > 0 ? "done" : "todo",
    },
    {
      label: "Add a connection",
      detail: `${root}connections/`,
      href: `${base}/connections`,
      state: project.connections.length > 0 ? "done" : "todo",
    },
    { label: "Connect GitHub", detail: "Source control", href: `${base}/source`, state: "todo" },
    { label: "Run the agent", detail: "Coming soon", state: "unavailable" },
    { label: "Deploy", detail: "Coming soon", state: "unavailable" },
  ];
  const done = steps.filter((step) => step.state === "done").length;

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="row" style={{ gap: "var(--space-4)", minWidth: 0 }}>
            <Avatar name={project.agent.name} size="large" />
            <div className="page-heading">
              <h1 className="page-title">{project.agent.name}</h1>
              <p className="page-description">
                {project.agent.description ?? "No description yet. Add one on the Agent page."}
              </p>
            </div>
          </div>
          <div className="page-actions">
            <Button asChild variant="outline">
              <Link href={fileHref(configPath)}>View agent.ts</Link>
            </Button>
            <Button asChild>
              <Link href={`${base}/canvas`}>Open canvas</Link>
            </Button>
          </div>
        </header>
      </Reveal>

      <Reveal delay={0.04}>
        <Card role="region" aria-label="Project summary" className="overview-hero grid gap-0 py-0">
          <Link className="overview-preview" href={`${base}/canvas`} aria-label="Open canvas">
            <GraphPreview graph={graph} positions={layout.positions} />
            <span className="overview-preview-cta" aria-hidden="true">
              <Icon icon={IconRoute} size={14} />
              Open canvas
            </span>
          </Link>
          <dl className="overview-details">
            {details.map((detail) => (
              <div className="overview-detail" key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>
                  {detail.href ? (
                    <Link className="overview-detail-link" href={detail.href}>
                      {detail.value}
                    </Link>
                  ) : (
                    detail.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </Reveal>

      {issues.length > 0 && (
        <Reveal delay={0.08}>
          <section className="section" id="issues">
            <h2 className="section-title">Needs attention</h2>
            <Card className="gap-0 py-0">
              <ul className="list">
                {issues.map((issue, index) => (
                  <li className="list-item" key={`${issue.at}-${index}`}>
                    <span className="list-item-detail">{issue.message}</span>
                    <code className="mono hint">{issue.at}</code>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </Reveal>
      )}

      <Reveal delay={0.08}>
        <section className="section">
          <h2 className="section-title">Capabilities</h2>
          <div className="grid-2">
            {columns.map((column) => (
              <Card className="overview-column gap-0 py-0" key={column.kind}>
                <div className="overview-column-head">
                  <KindTile kind={column.kind} />
                  <Link className="overview-column-title" href={column.href}>
                    {KINDS[column.kind].plural}
                  </Link>
                  <Badge variant="secondary" className="tabular-nums">
                    {column.items.length}
                  </Badge>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon-sm"
                    className="ms-auto"
                    aria-label={`Manage ${KINDS[column.kind].plural.toLowerCase()}`}
                  >
                    <Link href={column.href}>
                      <Icon icon={IconArrowUpRight} />
                    </Link>
                  </Button>
                </div>
                {column.items.length === 0 ? (
                  <p className="overview-empty">{column.empty}</p>
                ) : (
                  <ul className="list">
                    {column.items.slice(0, PREVIEW_LIMIT).map((item) => (
                      <li key={item.id}>
                        <Link className="overview-item" href={fileHref(item.path)}>
                          <span className="overview-item-name">{item.name}</span>
                          <span className="overview-item-detail">{item.detail}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {column.items.length > PREVIEW_LIMIT && (
                  <Link className="overview-more" href={column.href}>
                    View all {column.items.length}
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.12}>
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Launch checklist</h2>
            <span className="hint">
              {done} of {steps.length} done
            </span>
          </div>
          <Card className="gap-0 py-0">
            <ol className="list overview-steps">
              {steps.map((step) => {
                const icon =
                  step.state === "done"
                    ? IconCheckCircle
                    : step.state === "todo"
                      ? IconCircle
                      : IconMinusCircle;
                const body = (
                  <>
                    <Icon icon={icon} className="overview-step-icon" />
                    <span className="overview-step-label">{step.label}</span>
                    <span className="overview-step-detail">{step.detail}</span>
                    <span className="visually-hidden">
                      {step.state === "done" ? "Done" : step.state === "todo" ? "To do" : "Not available"}
                    </span>
                  </>
                );
                return (
                  <li key={step.label} data-state={step.state}>
                    {step.href ? (
                      <Link className="overview-step" href={step.href}>
                        {body}
                      </Link>
                    ) : (
                      <div className="overview-step">{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        </section>
      </Reveal>
    </div>
  );
}
