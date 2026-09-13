"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CanvasGraph, CanvasNode, CanvasNodeKind } from "@evelab/eve-project";
import {
  IconArrowUpRight,
  IconCheckCircle,
  IconCross,
  IconFullscreen,
  IconMinusCircle,
  IconMoreVertical,
  IconPlus,
  IconWarning,
} from "@/components/icons";
import { isAgentKind, isResourceKind } from "@/components/canvas/canvas-node";
import { CodeEditor, languageFor } from "@/components/editor";
import { Icon } from "@/components/icon";
import { KINDS, KindTile } from "@/components/kinds";
import { ResizeHandle } from "@/components/resize-handle";
import { SaveIndicator, type SaveState } from "@/components/save-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { saveFileAction } from "@/lib/actions";

export interface Issue {
  level: "error" | "warning";
  at: string;
  message: string;
}

/** Where the open file stands against the copy on disk. */
export type SourceState = "saved" | "dirty" | "conflict";

export type CreateKind = Exclude<CanvasNodeKind, "agent">;

/** Escape belongs to an open dialog or menu before it belongs to the canvas behind it. */
export function dialogIsOpen(): boolean {
  return document.querySelector('[role="alertdialog"], [role="dialog"], [role="menu"]') !== null;
}

const GROUP_ORDER: CreateKind[] = ["subagent", "tool", "skill", "connection", "channel"];
const SLOT: Record<"tool" | "skill" | "connection", string> = { tool: "tools", skill: "skills", connection: "connections" };

/** The floating panel on the right. It appears with a selection and leaves with it. */
export function InspectorColumn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside className="canvas-float canvas-inspector" aria-label={label}>
      <ResizeHandle pane="inspector" edge="start" label="Resize inspector" />
      {children}
    </aside>
  );
}

interface InspectorProps {
  projectId: string;
  graph: CanvasGraph;
  node?: CanvasNode;
  content: string;
  issues: Issue[];
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  onClear: () => void;
  onAttach: (resource: string, agent: string) => void;
  onDetach: (resource: string, agent: string) => void;
  onCreate: (kind: CreateKind, agent?: string) => void;
  onDelete: (node: CanvasNode) => void;
  onSourceState: (state: SourceState) => void;
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" type="button" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function plural(count: number, kind: CanvasNodeKind): string {
  return count === 1 ? KINDS[kind].label : KINDS[kind].plural;
}

/** The directory an agent's own slots live in: "agent/" or "agent/subagents/writer/". */
function agentDirectory(node: CanvasNode): string {
  return node.filePath.replace(/(agent\.ts|instructions\.md)$/, "");
}

/** Three readings across the top of the panel, the same numbers the card leads with. */
function metricsFor(graph: CanvasGraph, node: CanvasNode): { label: string; value: string }[] {
  const counts = node.counts;
  const resources = counts ? counts.tools + counts.skills + counts.connections : 0;
  if (node.kind === "agent") {
    return [
      { label: "Subagents", value: String(counts?.subagents ?? 0) },
      { label: "Resources", value: String(resources) },
      { label: "Channels", value: String(counts?.channels ?? 0) },
    ];
  }
  if (node.kind === "subagent") {
    return [
      { label: "Resources", value: String(resources) },
      { label: "Tools", value: String(counts?.tools ?? 0) },
      { label: "Nested", value: String(counts?.subagents ?? 0) },
    ];
  }
  if (node.kind === "channel") {
    const root = graph.nodes.find((entry) => entry.kind === "agent");
    return [
      { label: "Route", value: `/${node.name}` },
      { label: "Answers", value: root?.name ?? "root" },
    ];
  }
  return [
    { label: "Used by", value: String(node.usedBy?.length ?? 0) },
    { label: "Scope", value: node.shared ? "Shared" : "Local" },
    { label: "Type", value: node.detail.split(" · ")[0] ?? KINDS[node.kind].label },
  ];
}

/**
 * What is selected, in Eve's terms: a header with the things you do to it, the
 * readings from its card, its properties, and who it is wired to. The file
 * behind it is one tab away.
 */
export function CanvasInspector(props: InspectorProps) {
  const { node, projectId } = props;
  if (!node) return <ArchitectureSummary {...props} />;
  const filesHref = `/projects/${projectId}/files?path=${encodeURIComponent(node.filePath)}`;

  return (
    <div className="inspector-content" data-kind={node.kind} key={node.id}>
      <header className="inspector-hero">
        <div className="inspector-hero-row">
          <span className="inspector-tile" aria-hidden="true">
            <Icon icon={KINDS[node.kind].icon} size={18} />
          </span>
          <div className="inspector-hero-actions">
            <IconAction label="Focus on canvas" onClick={() => props.onFocus(node.id)}>
              <Icon icon={IconFullscreen} />
            </IconAction>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon-sm">
                  <Link href={filesHref} aria-label="Open in Files">
                    <Icon icon={IconArrowUpRight} />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open in Files</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <Icon icon={IconMoreVertical} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(node.filePath)}>Copy file path</DropdownMenuItem>
                {node.kind !== "agent" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => props.onDelete(node)}>
                      Delete {KINDS[node.kind].label.toLowerCase()}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <IconAction label="Close" onClick={props.onClear}>
              <Icon icon={IconCross} />
            </IconAction>
          </div>
        </div>
        <p className="inspector-eyebrow">
          <span className="inspector-dot" aria-hidden="true" />
          {node.kind === "agent" ? "Root agent" : KINDS[node.kind].label}
          {node.shared && <span className="node-shared">Shared</span>}
        </p>
        <h2 className="inspector-name">{node.name}</h2>
        {node.description && <p className="inspector-description">{node.description}</p>}
      </header>

      <dl className="inspector-metrics">
        {metricsFor(props.graph, node).map((metric) => (
          <div key={metric.label} className="inspector-metric">
            <dt>{metric.label}</dt>
            <dd title={metric.value}>{metric.value}</dd>
          </div>
        ))}
      </dl>

      <Tabs defaultValue="overview" className="inspector-tabs">
        <TabsList variant="line" className="inspector-tab-list">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="inspector-scroll">
          <Properties node={node} />
          {isAgentKind(node.kind) ? (
            <AgentRelations {...props} node={node} />
          ) : isResourceKind(node.kind) ? (
            <ResourceRelations {...props} node={node} />
          ) : null}
        </TabsContent>
        <TabsContent value="source" className="inspector-source">
          <SourceEditor projectId={projectId} path={node.filePath} content={props.content} onState={props.onSourceState} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Properties({ node }: { node: CanvasNode }) {
  const rows: [string, ReactNode][] = [];
  if (isAgentKind(node.kind)) {
    rows.push(["Model", node.detail]);
    rows.push(["Folder", agentDirectory(node) || "./"]);
    if (node.kind === "subagent") rows.push(["Inherits", "Nothing from its parent"]);
  } else if (node.kind === "channel") {
    rows.push(["Type", node.detail]);
    rows.push(["Route", `/eve/v1/${node.name}`]);
  } else {
    rows.push(["Type", node.detail]);
    rows.push(["Defined in", node.shared ? "lib/, re-exported by each agent" : "The folder of the agent using it"]);
  }
  rows.push(["File", node.filePath]);

  return (
    <section className="inspector-section">
      <h3 className="inspector-section-title">Properties</h3>
      <dl className="inspector-props">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Row({
  node,
  onSelect,
  action,
}: {
  node: CanvasNode;
  onSelect: (id: string) => void;
  action?: { label: string; run: () => void };
}) {
  return (
    <li className="inspector-row" data-kind={node.kind}>
      <button type="button" className="inspector-row-main" onClick={() => onSelect(node.id)}>
        <KindTile kind={node.kind} />
        <span className="inspector-row-text">
          <span className="inspector-row-name">{node.name}</span>
          <span className="inspector-row-detail">{node.detail}</span>
        </span>
        {node.shared && <span className="node-shared">Shared</span>}
      </button>
      {action && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="inspector-row-action"
              aria-label={`${action.label} ${node.name}`}
              onClick={action.run}
            >
              <Icon icon={IconMinusCircle} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{action.label}</TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}

function AgentRelations({ graph, node, onSelect, onAttach, onDetach, onCreate }: InspectorProps & { node: CanvasNode }) {
  const byId = useMemo(() => new Map(graph.nodes.map((entry) => [entry.id, entry])), [graph]);
  const children = graph.edges
    .filter((edge) => edge.source === node.id)
    .map((edge) => byId.get(edge.target))
    .filter((entry): entry is CanvasNode => Boolean(entry));
  const using = new Set(children.map((child) => child.id));
  const attachable = graph.nodes.filter((entry) => isResourceKind(entry.kind) && !using.has(entry.id));
  const creatable = GROUP_ORDER.filter((kind) => kind !== "channel" || node.kind === "agent");

  return (
    <section className="inspector-section">
      <h3 className="inspector-section-title">
        Wired to
        <span className="tabular-nums">{children.length}</span>
      </h3>

      {children.length === 0 && (
        <p className="inspector-empty">
          {node.kind === "subagent"
            ? "A subagent starts with nothing. Attach the tools, skills and connections it needs."
            : "Add subagents and resources to start the architecture."}
        </p>
      )}

      {GROUP_ORDER.map((kind) => {
        const items = children.filter((child) => child.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind} className="inspector-group">
            <p className="inspector-group-label">{plural(items.length, kind)}</p>
            <ul className="inspector-list">
              {items.map((item) => (
                <Row
                  key={item.id}
                  node={item}
                  onSelect={onSelect}
                  action={isResourceKind(item.kind) ? { label: "Detach", run: () => onDetach(item.id, node.id) } : undefined}
                />
              ))}
            </ul>
          </div>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inspector-add-row">
            <Icon icon={IconPlus} size={14} />
            Add to {node.name}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {attachable.length > 0 && (
            <>
              <DropdownMenuLabel>Attach existing</DropdownMenuLabel>
              {attachable.map((resource) => (
                <DropdownMenuItem key={resource.id} onSelect={() => onAttach(resource.id, node.id)}>
                  <KindTile kind={resource.kind} />
                  <span className="min-w-0 flex-1 truncate">{resource.name}</span>
                  {resource.shared && <span className="menu-meta">Shared</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>Create new</DropdownMenuLabel>
          {creatable.map((kind) => (
            <DropdownMenuItem key={kind} onSelect={() => onCreate(kind, node.id)}>
              <KindTile kind={kind} />
              {KINDS[kind].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  );
}

function ResourceRelations({ graph, node, onSelect, onAttach, onDetach }: InspectorProps & { node: CanvasNode }) {
  const byId = useMemo(() => new Map(graph.nodes.map((entry) => [entry.id, entry])), [graph]);
  const users = (node.usedBy ?? []).map((id) => byId.get(id)).filter((entry): entry is CanvasNode => Boolean(entry));
  const others = graph.nodes.filter((entry) => isAgentKind(entry.kind) && !node.usedBy?.includes(entry.id));
  const slot = isResourceKind(node.kind) ? SLOT[node.kind] : "tools";

  return (
    <>
      <section className="inspector-section">
        <h3 className="inspector-section-title">
          Used by
          <span className="tabular-nums">{users.length}</span>
        </h3>
        {users.length === 0 ? (
          <p className="inspector-empty">No agent uses this yet. It stays a definition in lib/ until one does.</p>
        ) : (
          <ul className="inspector-list">
            {users.map((user) => (
              <Row key={user.id} node={user} onSelect={onSelect} action={{ label: "Detach", run: () => onDetach(node.id, user.id) }} />
            ))}
          </ul>
        )}
        {others.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inspector-add-row">
                <Icon icon={IconPlus} size={14} />
                Attach to another agent
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {others.map((agent) => (
                <DropdownMenuItem key={agent.id} onSelect={() => onAttach(node.id, agent.id)}>
                  <KindTile kind={agent.kind} />
                  <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </section>

      <section className="inspector-section">
        <h3 className="inspector-section-title">Wiring</h3>
        {node.shared ? (
          <>
            <p className="inspector-note">One definition, and a one-line re-export in each agent&apos;s own folder.</p>
            <pre className="inspector-code">
              {users.map((user) => (
                <span key={user.id} className="inspector-code-block">
                  <span className="code-comment">{`// ${agentDirectory(user)}${slot}/${node.name}.ts`}</span>
                  {"\n"}
                  <span className="code-keyword">export</span> {"{ default } "}
                  <span className="code-keyword">from</span> <span className="code-string">{`"#lib/${slot}/${node.name}.ts"`}</span>
                  {";\n"}
                </span>
              ))}
              {users.length === 0 && <span className="code-comment">{"// No re-exports yet"}</span>}
            </pre>
          </>
        ) : (
          <p className="inspector-note">
            Defined in its agent&apos;s folder. Attach it to a second agent and EveLab moves the definition to{" "}
            <code className="mono">lib/{slot}/</code> and leaves each agent a re-export, never a copy.
          </p>
        )}
      </section>
    </>
  );
}

function ArchitectureSummary({ graph, issues, onCreate, onClear }: InspectorProps) {
  const count = (kind: CanvasNodeKind) => graph.nodes.filter((node) => node.kind === kind).length;
  const root = graph.nodes.find((node) => node.kind === "agent");
  const errors = issues.filter((issue) => issue.level === "error");

  return (
    <div className="inspector-content" data-kind="agent">
      <header className="inspector-hero">
        <div className="inspector-hero-row">
          <span className="inspector-tile" aria-hidden="true">
            <Icon icon={KINDS.agent.icon} size={18} />
          </span>
          <div className="inspector-hero-actions">
            <IconAction label="Close" onClick={onClear}>
              <Icon icon={IconCross} />
            </IconAction>
          </div>
        </div>
        <p className="inspector-eyebrow">Architecture</p>
        <h2 className="inspector-name">{root?.name}</h2>
        <p className="inspector-description mono">{root?.detail}</p>
      </header>

      <dl className="inspector-metrics">
        {(
          [
            ["Agents", count("agent") + count("subagent")],
            ["Resources", count("tool") + count("skill") + count("connection")],
            ["Shared", graph.nodes.filter((node) => node.shared).length],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="inspector-metric">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="inspector-scroll">
        <section className="inspector-section">
          <h3 className="inspector-section-title">
            Code sync
            <span className="tabular-nums">{issues.length}</span>
          </h3>
          {issues.length === 0 ? (
            <p className="inspector-status" data-tone="ok">
              <Icon icon={IconCheckCircle} size={14} />
              Every card maps to a file, and the project validates.
            </p>
          ) : (
            <ul className="inspector-issues">
              {issues.map((issue) => (
                <li key={`${issue.at}-${issue.message}`} data-level={issue.level}>
                  <Icon icon={IconWarning} size={14} />
                  <span>
                    <code className="mono">{issue.at || "project"}</code> {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {errors.length > 0 && <p className="inspector-note">Eve will refuse to build until the errors are fixed.</p>}
        </section>

        <section className="inspector-section">
          <h3 className="inspector-section-title">Grow it</h3>
          <div className="inspector-quick">
            {(["subagent", "tool", "skill", "connection"] as const).map((kind) => (
              <button key={kind} type="button" className="inspector-quick-item" data-kind={kind} onClick={() => onCreate(kind)}>
                <KindTile kind={kind} />
                {KINDS[kind].label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * The file behind the selection. When the file changes on disk while there
 * are unsaved edits, it says so instead of silently picking a side.
 */
function SourceEditor({
  projectId,
  path,
  content,
  onState,
}: {
  projectId: string;
  path: string;
  content: string;
  onState: (state: SourceState) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(content);
  const [base, setBase] = useState(content);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [incoming, setIncoming] = useState<string>();

  useEffect(() => {
    if (content === base) return;
    if (value === base) {
      setValue(content);
      setBase(content);
    } else {
      setIncoming(content);
    }
  }, [base, content, value]);

  useEffect(() => {
    onState(incoming !== undefined ? "conflict" : value === base ? "saved" : "dirty");
  }, [base, incoming, onState, value]);

  useEffect(() => () => onState("saved"), [onState]);

  const save = useCallback(async () => {
    if (value === base) return;
    setSaveState("saving");
    try {
      await saveFileAction(projectId, path, value);
      setBase(value);
      setIncoming(undefined);
      setSaveState("saved");
      router.refresh();
    } catch {
      setSaveState("error");
    }
  }, [base, path, projectId, router, value]);

  return (
    <>
      {incoming !== undefined && (
        <div className="inspector-conflict" role="alert">
          <p>This file changed on disk while you were editing.</p>
          <div className="row">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setValue(incoming);
                setBase(incoming);
                setIncoming(undefined);
              }}
            >
              Use disk version
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBase(incoming);
                setIncoming(undefined);
              }}
            >
              Keep mine
            </Button>
          </div>
        </div>
      )}
      <div className="inspector-editor">
        <CodeEditor
          value={value}
          language={languageFor(path)}
          onChange={(next) => {
            setValue(next);
            setSaveState(next === base ? "saved" : "dirty");
          }}
          onSave={() => void save()}
        />
      </div>
      <div className="inspector-source-bar">
        <SaveIndicator state={value === base && saveState === "dirty" ? "saved" : saveState} />
        <Button size="sm" onClick={() => void save()} disabled={value === base || saveState === "saving"}>
          Save
        </Button>
      </div>
    </>
  );
}
