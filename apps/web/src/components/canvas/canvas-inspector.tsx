"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CanvasGraph, CanvasNode, CanvasNodeKind } from "@evelab/eve-project";
import { IconCheckCircle, IconCross, IconMinusCircle, IconPlus, IconWarning } from "@/components/icons";
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

/** The right-hand column. Always there, so selecting something never moves the canvas. */
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
  onClear: () => void;
  onAttach: (resource: string, agent: string) => void;
  onDetach: (resource: string, agent: string) => void;
  onCreate: (kind: CreateKind, agent?: string) => void;
  onDelete: (node: CanvasNode) => void;
  onSourceState: (state: SourceState) => void;
}

/**
 * What is selected, in the terms Eve uses: an agent's resources, a resource's
 * users, and the file behind either. With nothing selected it describes the
 * whole architecture.
 */
export function CanvasInspector(props: InspectorProps) {
  const { node } = props;
  if (!node) return <ArchitectureSummary {...props} />;

  return (
    <div className="inspector-content" key={node.id}>
      <header className="inspector-header">
        <KindTile kind={node.kind} size="large" />
        <div className="inspector-titles">
          <p className="inspector-eyebrow">
            {node.kind === "agent" ? "Root agent" : KINDS[node.kind].label}
            {node.shared && <span className="node-shared" data-kind={node.kind}>Shared</span>}
          </p>
          <h2 className="inspector-name">{node.name}</h2>
          <p className="inspector-detail">{node.detail}</p>
        </div>
        <Button variant="ghost" size="icon-sm" type="button" aria-label="Clear selection" onClick={props.onClear}>
          <Icon icon={IconCross} />
        </Button>
      </header>

      <Tabs defaultValue="overview" className="inspector-tabs">
        <TabsList variant="line" className="inspector-tab-list">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="inspector-scroll">
          {node.description && <p className="inspector-description">{node.description}</p>}
          {isAgentKind(node.kind) ? (
            <AgentOverview {...props} node={node} />
          ) : isResourceKind(node.kind) ? (
            <ResourceOverview {...props} node={node} />
          ) : (
            <ChannelOverview {...props} node={node} />
          )}
        </TabsContent>
        <TabsContent value="source" className="inspector-source">
          <SourceEditor
            projectId={props.projectId}
            path={node.filePath}
            content={props.content}
            onState={props.onSourceState}
          />
        </TabsContent>
      </Tabs>

      <footer className="inspector-foot">
        <code className="inspector-path mono" title={node.filePath}>
          {node.filePath}
        </code>
        <div className="row">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/projects/${props.projectId}/files?path=${encodeURIComponent(node.filePath)}`}>Open in Files</Link>
          </Button>
          {node.kind !== "agent" && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => props.onDelete(node)}>
              Delete
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function byIdOf(graph: CanvasGraph) {
  return new Map(graph.nodes.map((entry) => [entry.id, entry]));
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
    <li className="inspector-row">
      <button type="button" className="inspector-row-main" onClick={() => onSelect(node.id)}>
        <KindTile kind={node.kind} />
        <span className="inspector-row-text">
          <span className="inspector-row-name">{node.name}</span>
          <span className="inspector-row-detail">{node.detail}</span>
        </span>
        {node.shared && <span className="node-shared" data-kind={node.kind}>Shared</span>}
      </button>
      {action && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`${action.label} ${node.name}`} onClick={action.run}>
              <Icon icon={IconMinusCircle} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{action.label}</TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}

function AgentOverview({ graph, node, onSelect, onAttach, onDetach, onCreate }: InspectorProps & { node: CanvasNode }) {
  const byId = useMemo(() => byIdOf(graph), [graph]);
  const children = graph.edges
    .filter((edge) => edge.source === node.id)
    .map((edge) => byId.get(edge.target))
    .filter((entry): entry is CanvasNode => Boolean(entry));
  const using = new Set(children.map((child) => child.id));
  const attachable = graph.nodes.filter((entry) => isResourceKind(entry.kind) && !using.has(entry.id));
  const creatable = GROUP_ORDER.filter((kind) => kind !== "channel" || node.kind === "agent");

  return (
    <>
      <div className="inspector-actions">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon icon={IconPlus} />
              Add resource
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {attachable.length > 0 && (
              <>
                <DropdownMenuLabel>Attach existing</DropdownMenuLabel>
                {attachable.map((resource) => (
                  <DropdownMenuItem key={resource.id} onSelect={() => onAttach(resource.id, node.id)}>
                    <KindTile kind={resource.kind} />
                    <span className="min-w-0 flex-1 truncate">{resource.name}</span>
                    <span className="menu-meta">{KINDS[resource.kind].label}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel>Create in {node.name}</DropdownMenuLabel>
            {creatable.map((kind) => (
              <DropdownMenuItem key={kind} onSelect={() => onCreate(kind, node.id)}>
                <KindTile kind={kind} />
                New {KINDS[kind].label.toLowerCase()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {children.length === 0 && (
        <p className="inspector-empty">
          {node.name} has nothing of its own yet. In Eve a subagent inherits nothing, so attach what it needs.
        </p>
      )}

      {GROUP_ORDER.map((kind) => {
        const items = children.filter((child) => child.kind === kind);
        if (items.length === 0) return null;
        return (
          <section key={kind} className="inspector-section">
            <h3 className="inspector-section-title">
              {KINDS[kind].plural}
              <span className="tabular-nums">{items.length}</span>
            </h3>
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
          </section>
        );
      })}
    </>
  );
}

function ResourceOverview({ graph, node, onSelect, onAttach, onDetach }: InspectorProps & { node: CanvasNode }) {
  const byId = useMemo(() => byIdOf(graph), [graph]);
  const users = (node.usedBy ?? []).map((id) => byId.get(id)).filter((entry): entry is CanvasNode => Boolean(entry));
  const others = graph.nodes.filter((entry) => isAgentKind(entry.kind) && !node.usedBy?.includes(entry.id));

  return (
    <>
      <section className="inspector-section">
        <h3 className="inspector-section-title">
          Used by
          <span className="tabular-nums">{users.length}</span>
        </h3>
        {users.length === 0 ? (
          <p className="inspector-empty">No agent uses this yet. Attach it to one, or it stays a definition in lib/.</p>
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
              <Button variant="outline" size="sm" className="self-start">
                <Icon icon={IconPlus} />
                Attach to agent
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
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
        <h3 className="inspector-section-title">How Eve sees it</h3>
        <p className="inspector-note">
          {node.shared ? (
            <>
              Defined once in <code className="mono">{node.filePath}</code>. Every agent above has a one-line re-export in its
              own folder, so a change here reaches all of them.
            </>
          ) : (
            <>
              Defined in <code className="mono">{node.filePath}</code>. Attach it to a second agent and EveLab moves the
              definition to <code className="mono">lib/</code>, leaving each agent a re-export instead of a copy.
            </>
          )}
        </p>
      </section>
    </>
  );
}

function ChannelOverview({ graph, node }: InspectorProps & { node: CanvasNode }) {
  const root = graph.nodes.find((entry) => entry.kind === "agent");
  return (
    <section className="inspector-section">
      <h3 className="inspector-section-title">Routing</h3>
      <p className="inspector-note">
        Messages arriving at <code className="mono">/eve/v1/{node.name}</code> go to {root?.name ?? "the root agent"}. Channels
        belong to the root; subagents are reached through it.
      </p>
    </section>
  );
}

function ArchitectureSummary({ graph, issues, onCreate, onClear }: InspectorProps) {
  const count = (kind: CanvasNodeKind) => graph.nodes.filter((node) => node.kind === kind).length;
  const shared = graph.nodes.filter((node) => node.shared).length;
  const root = graph.nodes.find((node) => node.kind === "agent");
  const errors = issues.filter((issue) => issue.level === "error");

  return (
    <div className="inspector-content">
      <header className="inspector-header">
        <KindTile kind="agent" size="large" />
        <div className="inspector-titles">
          <p className="inspector-eyebrow">Architecture</p>
          <h2 className="inspector-name">{root?.name}</h2>
          <p className="inspector-detail">{root?.detail}</p>
        </div>
        <Button variant="ghost" size="icon-sm" type="button" aria-label="Close" onClick={onClear}>
          <Icon icon={IconCross} />
        </Button>
      </header>

      <div className="inspector-scroll">
        <dl className="inspector-stats">
          {GROUP_ORDER.map((kind) => (
            <div key={kind} className="inspector-stat" data-kind={kind}>
              <dt>
                <KindTile kind={kind} />
                {KINDS[kind].plural}
              </dt>
              <dd className="tabular-nums">{count(kind)}</dd>
            </div>
          ))}
          <div className="inspector-stat">
            <dt>Shared resources</dt>
            <dd className="tabular-nums">{shared}</dd>
          </div>
        </dl>

        <div className="inspector-actions">
          <Button variant="outline" size="sm" onClick={() => onCreate("subagent")}>
            <Icon icon={IconPlus} />
            New subagent
          </Button>
        </div>

        <section className="inspector-section">
          <h3 className="inspector-section-title">Code sync</h3>
          {issues.length === 0 ? (
            <p className="inspector-status" data-tone="ok">
              <Icon icon={IconCheckCircle} size={14} />
              Every node maps to a file, and the project validates.
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
          <h3 className="inspector-section-title">Shortcuts</h3>
          <dl className="inspector-keys">
            {[
              ["A", "Add resource"],
              ["N", "New note"],
              ["S", "New section"],
              ["F", "Focus selection"],
              ["0", "Fit everything"],
              ["1", "Go to root"],
              ["Space", "Hold to pan"],
              ["Ctrl Z", "Undo"],
              ["Ctrl Shift Z", "Redo"],
              ["Ctrl C, Ctrl V", "Attach copies to the selected agent"],
              ["Delete", "Detach edge or delete node"],
            ].map(([keys, label]) => (
              <div key={keys}>
                <dt>
                  {keys!.split(", ").map((combo) => (
                    <kbd key={combo}>{combo}</kbd>
                  ))}
                </dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
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
