"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CanvasGraph, CanvasNode, CanvasNodeKind } from "@evelab/eve-project";
import {
  IconCheckCircle,
  IconCopy,
  IconCross,
  IconExternalLink,
  IconFocus,
  IconMinusCircle,
  IconMoreVertical,
  IconPlus,
  IconTrash,
  IconWarning,
} from "@/components/icons";
import { isAgentKind, isResourceKind } from "@/components/canvas/canvas-node";
import { allPortsFor } from "@/components/canvas/layout";
import { CodeEditor, languageFor } from "@/components/editor";
import { Icon } from "@/components/icon";
import { KINDS, KindTile } from "@/components/kinds";
import { ResizeHandle } from "@/components/resize-handle";
import { SaveIndicator, type SaveState } from "@/components/save-state";
import { Badge } from "@/components/ui/badge";
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

const SLOT: Record<"tool" | "skill" | "connection", string> = { tool: "tools", skill: "skills", connection: "connections" };
const COUNT_KEY = { subagent: "subagents", tool: "tools", skill: "skills", connection: "connections", channel: "channels" } as const;

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

/** A bordered group, the way Vercel's dashboard frames a settings block. */
function PanelCard({ title, meta, action, children }: { title: string; meta?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="insp-card">
      <header className="insp-card-head">
        <h3>{title}</h3>
        {meta !== undefined && <span className="insp-card-meta">{meta}</span>}
        {action && <div className="insp-card-action">{action}</div>}
      </header>
      {children}
    </section>
  );
}

function Details({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="insp-details">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Item({
  node,
  onSelect,
  onDetach,
}: {
  node: CanvasNode;
  onSelect: (id: string) => void;
  onDetach?: () => void;
}) {
  return (
    <li className="insp-item" data-kind={node.kind}>
      <button type="button" className="insp-item-main" onClick={() => onSelect(node.id)}>
        <KindTile kind={node.kind} />
        <span className="insp-item-text">
          <span className="insp-item-name">{node.name}</span>
          <span className="insp-item-detail">{node.detail}</span>
        </span>
        {node.shared && (
          <Badge variant="outline" className="insp-shared">
            Shared
          </Badge>
        )}
      </button>
      {onDetach && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="insp-item-action" aria-label={`Detach ${node.name}`} onClick={onDetach}>
              <Icon icon={IconMinusCircle} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Detach</TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}

/**
 * What is selected, laid out like a Vercel dashboard panel: who it is and the
 * two things you do most, then cards for its details, its ports and what it is
 * wired to. The file behind it is one tab away.
 */
export function CanvasInspector(props: InspectorProps) {
  const { node, projectId } = props;
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState<CreateKind | "all">("all");

  useEffect(() => {
    setTab("overview");
    setFilter("all");
  }, [node?.id]);

  if (!node) return <ArchitectureSummary {...props} />;
  const filesHref = `/projects/${projectId}/files?path=${encodeURIComponent(node.filePath)}`;
  const wired = props.graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length;

  return (
    <div className="inspector-content" data-kind={node.kind} key={node.id}>
      <header className="insp-header">
        <div className="insp-toprow">
          <KindTile kind={node.kind} size="large" />
          <div className="insp-title">
            <h2 className="insp-name">{node.name}</h2>
            <span className="insp-kind">
              {node.kind === "agent" ? "Root agent" : KINDS[node.kind].label}
              {node.shared && (
                <Badge variant="outline" className="insp-shared">
                  Shared
                </Badge>
              )}
            </span>
          </div>
          <div className="insp-toprow-actions">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <Icon icon={IconMoreVertical} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(node.filePath)}>
                  <Icon icon={IconCopy} />
                  Copy file path
                </DropdownMenuItem>
                {node.kind !== "agent" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => props.onDelete(node)}>
                      <Icon icon={IconTrash} />
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
        {node.description && <p className="insp-description">{node.description}</p>}
        <div className="insp-actions">
          <Button asChild size="sm" variant="outline">
            <Link href={filesHref}>
              <Icon icon={IconExternalLink} size={14} />
              Open file
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => props.onFocus(node.id)}>
            <Icon icon={IconFocus} size={14} />
            Focus
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="insp-tabs">
        <div className="insp-tabbar">
          <TabsList variant="line" className="w-full justify-start gap-4">
            <TabsTrigger value="overview" className="flex-none px-0.5">
              Overview
            </TabsTrigger>
            <TabsTrigger value="wiring" className="flex-none px-0.5">
              Wiring
              <span className="insp-tab-count">{wired}</span>
            </TabsTrigger>
            <TabsTrigger value="source" className="flex-none px-0.5">
              Source
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="insp-scroll">
          <PanelCard title="Details">
            <Details rows={detailRows(node)} />
          </PanelCard>
          {isAgentKind(node.kind) && (
            <PanelCard title="Ports" meta={`${props.graph.edges.filter((edge) => edge.source === node.id).length} wired`}>
              <div className="insp-ports">
                {allPortsFor(node.kind).map((port) => {
                  const count = node.counts?.[COUNT_KEY[port]] ?? 0;
                  return (
                    <button
                      key={port}
                      type="button"
                      className="insp-port"
                      data-kind={port}
                      data-empty={count === 0 || undefined}
                      onClick={() => {
                        setFilter(port);
                        setTab("wiring");
                      }}
                    >
                      <KindTile kind={port} />
                      <span className="insp-port-label">{KINDS[port].plural}</span>
                      <strong className="tabular-nums" aria-label={`${count} ${plural(count, port)}`}>
                        {count}
                      </strong>
                    </button>
                  );
                })}
              </div>
            </PanelCard>
          )}
          {isResourceKind(node.kind) && <Wiring {...props} node={node} />}
        </TabsContent>

        <TabsContent value="wiring" className="insp-scroll">
          {isAgentKind(node.kind) ? (
            <AgentWiring {...props} node={node} filter={filter} onFilter={setFilter} />
          ) : isResourceKind(node.kind) ? (
            <UsedBy {...props} node={node} />
          ) : (
            <PanelCard title="Routing">
              <p className="insp-note">
                Messages to <code className="mono">/eve/v1/{node.name}</code> go to the root agent. Channels belong to the root,
                and subagents are reached through it.
              </p>
            </PanelCard>
          )}
        </TabsContent>

        <TabsContent value="source" className="inspector-source">
          <SourceEditor projectId={projectId} path={node.filePath} content={props.content} onState={props.onSourceState} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function detailRows(node: CanvasNode): [string, ReactNode][] {
  const mono = (value: string) => <span className="mono">{value}</span>;
  if (isAgentKind(node.kind)) {
    return [
      ["Model", mono(node.detail)],
      ["Folder", mono(agentDirectory(node) || "./")],
      ["Instructions", mono(node.filePath)],
      ...(node.kind === "subagent" ? ([["Inherits", "Nothing from its parent"]] as [string, ReactNode][]) : []),
    ];
  }
  if (node.kind === "channel") {
    return [
      ["Type", node.detail],
      ["Route", mono(`/eve/v1/${node.name}`)],
      ["File", mono(node.filePath)],
    ];
  }
  const users = node.usedBy?.length ?? 0;
  return [
    ["Type", node.detail],
    ["Scope", node.shared ? "Shared definition in lib/" : "Defined in its agent's folder"],
    ["Used by", `${users} ${users === 1 ? "agent" : "agents"}`],
    ["File", mono(node.filePath)],
  ];
}

function AgentWiring({
  graph,
  node,
  filter,
  onFilter,
  onSelect,
  onAttach,
  onDetach,
  onCreate,
}: InspectorProps & { node: CanvasNode; filter: CreateKind | "all"; onFilter: (kind: CreateKind | "all") => void }) {
  const byId = useMemo(() => new Map(graph.nodes.map((entry) => [entry.id, entry])), [graph]);
  const children = graph.edges
    .filter((edge) => edge.source === node.id)
    .map((edge) => byId.get(edge.target))
    .filter((entry): entry is CanvasNode => Boolean(entry));
  const using = new Set(children.map((child) => child.id));
  const attachable = graph.nodes.filter((entry) => isResourceKind(entry.kind) && !using.has(entry.id));
  const ports = allPortsFor(node.kind);
  const shown = ports.filter((port) => filter === "all" || filter === port);

  return (
    <>
      <div className="insp-filters" role="group" aria-label="Filter by port">
        {(["all", ...ports] as const).map((value) => {
          const count = value === "all" ? children.length : children.filter((child) => child.kind === value).length;
          return (
            <button
              key={value}
              type="button"
              className="insp-filter"
              data-kind={value === "all" ? undefined : value}
              aria-pressed={filter === value}
              onClick={() => onFilter(value)}
            >
              {value === "all" ? "All" : KINDS[value].plural}
              <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.map((port) => {
        const items = children.filter((child) => child.kind === port);
        if (filter === "all" && items.length === 0) return null;
        return (
          <PanelCard
            key={port}
            title={KINDS[port].plural}
            meta={items.length}
            action={
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`New ${KINDS[port].label.toLowerCase()}`} onClick={() => onCreate(port, node.id)}>
                    <Icon icon={IconPlus} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">New {KINDS[port].label.toLowerCase()}</TooltipContent>
              </Tooltip>
            }
          >
            {items.length === 0 ? (
              <p className="insp-empty">No {KINDS[port].plural.toLowerCase()} yet.</p>
            ) : (
              <ul className="insp-list">
                {items.map((item) => (
                  <Item
                    key={item.id}
                    node={item}
                    onSelect={onSelect}
                    onDetach={isResourceKind(item.kind) ? () => onDetach(item.id, node.id) : undefined}
                  />
                ))}
              </ul>
            )}
          </PanelCard>
        );
      })}

      {children.length === 0 && filter === "all" && (
        <p className="insp-note">
          {node.kind === "subagent"
            ? "A subagent starts with nothing. Attach the tools, skills and connections it needs."
            : "Add subagents and resources to start the architecture."}
        </p>
      )}

      {attachable.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="insp-wide-button">
              <Icon icon={IconPlus} size={14} />
              Attach an existing resource
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Attach to {node.name}</DropdownMenuLabel>
            {attachable.map((resource) => (
              <DropdownMenuItem key={resource.id} onSelect={() => onAttach(resource.id, node.id)}>
                <KindTile kind={resource.kind} />
                <span className="min-w-0 flex-1 truncate">{resource.name}</span>
                {resource.shared && <span className="menu-meta">Shared</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

function UsedBy({ graph, node, onSelect, onAttach, onDetach }: InspectorProps & { node: CanvasNode }) {
  const byId = useMemo(() => new Map(graph.nodes.map((entry) => [entry.id, entry])), [graph]);
  const users = (node.usedBy ?? []).map((id) => byId.get(id)).filter((entry): entry is CanvasNode => Boolean(entry));
  const others = graph.nodes.filter((entry) => isAgentKind(entry.kind) && !node.usedBy?.includes(entry.id));

  return (
    <PanelCard
      title="Used by"
      meta={users.length}
      action={
        others.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Attach to another agent">
                <Icon icon={IconPlus} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Attach to</DropdownMenuLabel>
              {others.map((agent) => (
                <DropdownMenuItem key={agent.id} onSelect={() => onAttach(node.id, agent.id)}>
                  <KindTile kind={agent.kind} />
                  <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
    >
      {users.length === 0 ? (
        <p className="insp-empty">No agent uses this yet. It stays a definition in lib/ until one does.</p>
      ) : (
        <ul className="insp-list">
          {users.map((user) => (
            <Item key={user.id} node={user} onSelect={onSelect} onDetach={() => onDetach(node.id, user.id)} />
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

function Wiring({ graph, node }: InspectorProps & { node: CanvasNode }) {
  const byId = useMemo(() => new Map(graph.nodes.map((entry) => [entry.id, entry])), [graph]);
  const users = (node.usedBy ?? []).map((id) => byId.get(id)).filter((entry): entry is CanvasNode => Boolean(entry));
  const slot = isResourceKind(node.kind) ? SLOT[node.kind] : "tools";

  return (
    <PanelCard title="How Eve loads it">
      {node.shared ? (
        <pre className="insp-code">
          {users.map((user, index) => (
            <span key={user.id}>
              {index > 0 && "\n\n"}
              <span className="code-comment">{`// ${agentDirectory(user)}${slot}/${node.name}.ts`}</span>
              {"\n"}
              <span className="code-keyword">export</span>
              {" { default } "}
              <span className="code-keyword">from</span> <span className="code-string">{`"#lib/${slot}/${node.name}.ts"`}</span>
              {";"}
            </span>
          ))}
          {users.length === 0 && <span className="code-comment">{"// No re-exports yet"}</span>}
        </pre>
      ) : (
        <p className="insp-note">
          Defined in its agent&apos;s folder. Attach it to a second agent and evelab moves the definition to{" "}
          <code className="mono">lib/{slot}/</code>, leaving each agent a one-line re-export instead of a copy.
        </p>
      )}
    </PanelCard>
  );
}

function ArchitectureSummary({ graph, issues, onCreate, onClear }: InspectorProps) {
  const count = (kind: CanvasNodeKind) => graph.nodes.filter((node) => node.kind === kind).length;
  const root = graph.nodes.find((node) => node.kind === "agent");
  const errors = issues.filter((issue) => issue.level === "error");
  const stats: [string, number][] = [
    ["Agents", count("agent") + count("subagent")],
    ["Resources", count("tool") + count("skill") + count("connection")],
    ["Channels", count("channel")],
    ["Shared", graph.nodes.filter((node) => node.shared).length],
  ];

  return (
    <div className="inspector-content" data-kind="agent">
      <header className="insp-header">
        <div className="insp-toprow">
          <KindTile kind="agent" size="large" />
          <div className="insp-title">
            <h2 className="insp-name">{root?.name}</h2>
            <span className="insp-kind">Architecture</span>
          </div>
          <div className="insp-toprow-actions">
            <IconAction label="Close" onClick={onClear}>
              <Icon icon={IconCross} />
            </IconAction>
          </div>
        </div>
        <p className="insp-description mono">{root?.detail}</p>
      </header>

      <div className="insp-scroll">
        <div className="insp-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong className="tabular-nums">{value}</strong>
            </div>
          ))}
        </div>

        <PanelCard title="Code sync" meta={issues.length === 0 ? undefined : issues.length}>
          {issues.length === 0 ? (
            <p className="insp-status" data-tone="ok">
              <Icon icon={IconCheckCircle} size={14} />
              Every card maps to a file, and the project validates.
            </p>
          ) : (
            <ul className="insp-issues">
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
          {errors.length > 0 && <p className="insp-note">Eve will refuse to build until the errors are fixed.</p>}
        </PanelCard>

        <PanelCard title="Add to the architecture">
          <div className="insp-quick">
            {(["subagent", "tool", "skill", "connection"] as const).map((kind) => (
              <button key={kind} type="button" className="insp-quick-item" data-kind={kind} onClick={() => onCreate(kind)}>
                <KindTile kind={kind} />
                {KINDS[kind].label}
              </button>
            ))}
          </div>
        </PanelCard>
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
