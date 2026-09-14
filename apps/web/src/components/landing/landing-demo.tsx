"use client";

import { createElement, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  renderChannelModule,
  renderConnectionModule,
  renderProjectScaffold,
  renderSubagentConfig,
  renderToolModule,
} from "@evelab/eve-project/templates";
import { Icon } from "@/components/icon";
import { IconCheck, IconCopy, IconRotateCounterClockwise } from "@/components/icons";
import { KINDS } from "@/components/kinds";
import { Mark } from "@/components/mark";
import "@/app/landing-demo.css";

const AGENT = "support-desk";
const MODEL = "anthropic/claude-opus-4.8";

type PieceKind = "subagent" | "tool" | "skill" | "connection" | "channel";
type NodeKind = PieceKind | "agent";

interface Piece {
  id: string;
  kind: PieceKind;
  name: string;
  path: string;
  content: string;
}

const PALETTE: readonly PieceKind[] = ["subagent", "tool", "skill", "connection", "channel"];

/**
 * What the demo can add, written by the same templates EveLab uses in a real
 * project, so the code a visitor sees is the code they would get.
 */
const PIECES: Record<PieceKind, Piece[]> = {
  subagent: [
    {
      id: "billing",
      kind: "subagent",
      name: "billing",
      path: "agent/subagents/billing/agent.ts",
      content: renderSubagentConfig("Answers billing questions and issues refunds within policy.", MODEL),
    },
    {
      id: "researcher",
      kind: "subagent",
      name: "researcher",
      path: "agent/subagents/researcher/agent.ts",
      content: renderSubagentConfig("Digs through docs and past tickets for an answer.", MODEL),
    },
  ],
  tool: [
    {
      id: "search_docs",
      kind: "tool",
      name: "search_docs",
      path: "agent/tools/search_docs.ts",
      content: renderToolModule("Search the product documentation and help centre."),
    },
    {
      id: "create_ticket",
      kind: "tool",
      name: "create_ticket",
      path: "agent/tools/create_ticket.ts",
      content: renderToolModule("Open a support ticket with priority and owner."),
    },
  ],
  skill: [
    {
      id: "triage",
      kind: "skill",
      name: "triage",
      path: "agent/skills/triage/SKILL.md",
      content:
        "---\ndescription: Classify a conversation by urgency, product area and customer tier.\n---\n\n# Triage\n\nRead the conversation, then label it:\n\n- Urgency: low, normal or urgent\n- Area: billing, product or account\n- Tier: free, pro or enterprise\n",
    },
  ],
  connection: [
    {
      id: "github",
      kind: "connection",
      name: "github",
      path: "agent/connections/github.ts",
      content: renderConnectionModule({
        kind: "mcp",
        url: "https://api.githubcopilot.com/mcp/",
        description: "Repositories, issues and pull requests.",
        auth: "connect",
        connector: "github/support-desk",
        filter: { mode: "allow", names: ["search_issues", "get_issue"] },
      }),
    },
    {
      id: "linear",
      kind: "connection",
      name: "linear",
      path: "agent/connections/linear.ts",
      content: renderConnectionModule({
        kind: "mcp",
        url: "https://mcp.linear.app/mcp",
        description: "Issues, projects and cycles in Linear.",
        auth: "connect",
        connector: "linear/support-desk",
      }),
    },
  ],
  channel: [
    {
      id: "slack",
      kind: "channel",
      name: "slack",
      path: "agent/channels/slack.ts",
      content: renderChannelModule({ kind: "slack", connector: "slack/support-desk" }),
    },
    {
      id: "telegram",
      kind: "channel",
      name: "telegram",
      path: "agent/channels/telegram.ts",
      content: renderChannelModule({ kind: "telegram", botUsername: "support_desk_bot" }),
    },
  ],
};

const BY_ID = new Map(Object.values(PIECES).flatMap((pieces) => pieces.map((piece) => [piece.id, piece] as const)));

const SCAFFOLD = renderProjectScaffold({
  packageName: AGENT,
  model: MODEL,
  instructions: "# Identity\n\nYou are the front door for customer support. Answer what you can and hand the rest to the right subagent.\n",
});

function isPieceKind(value: string): value is PieceKind {
  return (PALETTE as readonly string[]).includes(value);
}

/** Folders before files at each level, then by name, like a file explorer. */
function comparePaths(a: string, b: string): number {
  const left = a.split("/");
  const right = b.split("/");
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (left[index] === right[index]) continue;
    const leftDir = index < left.length - 1;
    const rightDir = index < right.length - 1;
    if (leftDir !== rightDir) return leftDir ? -1 : 1;
    return left[index] < right[index] ? -1 : 1;
  }
  return left.length - right.length;
}

interface TreeRow {
  path: string;
  name: string;
  depth: number;
  dir: boolean;
}

function treeRows(paths: readonly string[]): TreeRow[] {
  const rows: TreeRow[] = [];
  const seen = new Set<string>();
  for (const path of paths) {
    const parts = path.split("/");
    parts.forEach((part, index) => {
      const sub = parts.slice(0, index + 1).join("/");
      const dir = index < parts.length - 1;
      if (dir && seen.has(sub)) return;
      seen.add(sub);
      rows.push({ path: sub, name: part, depth: index, dir });
    });
  }
  return rows;
}

const TOKEN = /("(?:[^"\\]|\\.)*")|(\/\/.*$)|\b(import|from|export|default|async|await|return|const)\b/g;

/** Just enough colour to read the code: keywords, strings and comments. */
function highlight(line: string, markdown: boolean): ReactNode {
  if (line === "") return " ";
  if (markdown) return /^(#|---)/.test(line) ? <span className="demo-tok-key">{line}</span> : line;
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) out.push(line.slice(last, start));
    const className = match[1] ? "demo-tok-string" : match[2] ? "demo-tok-comment" : "demo-tok-key";
    out.push(
      <span key={start} className={className}>
        {match[0]}
      </span>,
    );
    last = start + match[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/* The board is drawn in its own coordinates and scaled to fit, like the canvas preview. */
const W = 880;
const H = 420;
const TILE = 52;
const ROOT = { w: 256, h: 64, y: 160 };
const SUB = { w: 150, h: 52 };
const CHANNEL_Y = 40;
const LOWER_Y = 300;

interface BoardNode {
  id: string;
  kind: NodeKind;
  name: string;
  path: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
}

function layoutBoard(pieces: readonly Piece[]) {
  const root: BoardNode = { id: AGENT, kind: "agent", name: AGENT, path: "agent/agent.ts", x: W / 2 - ROOT.w / 2, y: ROOT.y, w: ROOT.w, h: ROOT.h, cx: W / 2 };

  const channelList = [{ id: "eve", name: "eve", path: "agent/channels/eve.ts" }, ...pieces.filter((piece) => piece.kind === "channel")];
  const channelStart = W / 2 - (channelList.length * 120) / 2;
  const channels: BoardNode[] = channelList.map((channel, index) => {
    const cx = channelStart + 60 + index * 120;
    return { id: channel.id, kind: "channel", name: channel.name, path: channel.path, x: cx - TILE / 2, y: CHANNEL_Y, w: TILE, h: TILE, cx };
  });

  const lowerList = pieces.filter((piece) => piece.kind !== "channel");
  const slots = lowerList.map((piece) => (piece.kind === "subagent" ? 176 : 100));
  let cursor = W / 2 - slots.reduce((sum, slot) => sum + slot, 0) / 2;
  const lower: BoardNode[] = lowerList.map((piece, index) => {
    const cx = cursor + slots[index] / 2;
    cursor += slots[index];
    const size = piece.kind === "subagent" ? SUB : { w: TILE, h: TILE };
    return { id: piece.id, kind: piece.kind, name: piece.name, path: piece.path, x: cx - size.w / 2, y: LOWER_Y, w: size.w, h: size.h, cx };
  });

  return { root, channels, lower };
}

function Glyph({ kind, x, y, size }: { kind: NodeKind; x: number; y: number; size: number }) {
  return (
    <svg
      className="demo-node-glyph"
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {KINDS[kind].icon.nodes.map(([tag, attributes], index) => createElement(tag, { key: index, ...attributes }))}
    </svg>
  );
}

/**
 * The landing page's playground: a small canvas that writes real Eve code.
 * Drag a piece onto the agent, or click it, and the file EveLab would write
 * appears beside the canvas, wired into the same project eve init creates.
 */
export function LandingDemo({ cta }: { cta: ReactNode }) {
  const [added, setAdded] = useState<string[]>([]);
  const [selected, setSelected] = useState("agent/agent.ts");
  const [latest, setLatest] = useState<string>();
  const [over, setOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const pieces = useMemo(() => added.flatMap((id) => BY_ID.get(id) ?? []), [added]);
  const files = useMemo(
    () => [...SCAFFOLD, ...pieces.map((piece) => ({ path: piece.path, content: piece.content }))].sort((a, b) => comparePaths(a.path, b.path)),
    [pieces],
  );
  const rows = useMemo(() => treeRows(files.map((file) => file.path)), [files]);
  const board = useMemo(() => layoutBoard(pieces), [pieces]);
  const current = files.find((file) => file.path === selected) ?? files[0];
  const latestPath = latest ? BY_ID.get(latest)?.path : undefined;

  function add(kind: PieceKind) {
    const piece = PIECES[kind].find((candidate) => !added.includes(candidate.id));
    if (!piece) return;
    setAdded((current) => [...current, piece.id]);
    setLatest(piece.id);
    setSelected(piece.path);
    setAnnouncement(`Added ${piece.name}. EveLab wrote ${piece.path}.`);
  }

  function reset() {
    setAdded([]);
    setLatest(undefined);
    setSelected("agent/agent.ts");
    setAnnouncement("The demo is back to a new project.");
  }

  function copy() {
    void navigator.clipboard?.writeText(current.content).then(() => {
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    const kind = event.dataTransfer.getData("text/plain");
    if (isPieceKind(kind)) add(kind);
  }

  function onNodeKey(event: KeyboardEvent<SVGGElement>, path: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected(path);
    }
  }

  function nodeProps(node: BoardNode) {
    return {
      className: "demo-node",
      "data-kind": node.kind,
      "data-selected": node.path === current.path || undefined,
      "data-new": node.id === latest || undefined,
      role: "button",
      tabIndex: 0,
      "aria-label": `Open ${node.path}`,
      onClick: () => setSelected(node.path),
      onKeyDown: (event: KeyboardEvent<SVGGElement>) => onNodeKey(event, node.path),
    };
  }

  const wire = (node: BoardNode, channel: boolean) =>
    channel
      ? `M ${W / 2} ${ROOT.y} C ${W / 2} ${ROOT.y - 36}, ${node.cx} ${node.y + node.h + 36}, ${node.cx} ${node.y + node.h}`
      : `M ${W / 2} ${ROOT.y + ROOT.h} C ${W / 2} ${ROOT.y + ROOT.h + 38}, ${node.cx} ${node.y - 38}, ${node.cx} ${node.y}`;

  return (
    <div className="demo">
      <div className="demo-bar">
        <Mark />
        <span className="demo-crumb">{AGENT}</span>
        <span className="demo-crumb-muted">/</span>
        <span className="demo-crumb-muted">Canvas</span>
        <span className="demo-bar-hint">This canvas writes real Eve code. Try it.</span>
        <span className="demo-bar-end">{cta}</span>
      </div>

      <div className="demo-palette" aria-label="Pieces">
        <p className="demo-palette-label">Pieces</p>
        {PALETTE.map((kind) => {
          const left = PIECES[kind].filter((piece) => !added.includes(piece.id)).length;
          return (
            <button
              key={kind}
              type="button"
              className="demo-piece"
              data-kind={kind}
              draggable={left > 0}
              disabled={left === 0}
              aria-label={`Add a ${KINDS[kind].label.toLowerCase()}`}
              onClick={() => add(kind)}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", kind);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <span className="demo-piece-icon">
                <Icon icon={KINDS[kind].icon} size={15} />
              </span>
              {KINDS[kind].label}
              <span className="demo-piece-count">{left}</span>
            </button>
          );
        })}
        <p className="demo-palette-foot">Drag onto the agent, or click to add.</p>
      </div>

      <div
        className="demo-board"
        data-over={over || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={onDrop}
      >
        <svg className="demo-dots" aria-hidden="true">
          <pattern id="demo-dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1" fill="currentColor" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#demo-dots)" />
        </svg>

        <svg className="demo-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {board.channels.map((node) => (
            <path key={`wire-${node.id}`} className="demo-wire" data-kind="channel" data-new={node.id === latest || undefined} pathLength={1} d={wire(node, true)} />
          ))}
          {board.lower.map((node) => (
            <path key={`wire-${node.id}`} className="demo-wire" data-kind={node.kind} data-new={node.id === latest || undefined} pathLength={1} d={wire(node, false)} />
          ))}

          <g {...nodeProps(board.root)}>
            <rect className="demo-node-card" x={board.root.x} y={board.root.y} width={ROOT.w} height={ROOT.h} rx={16} />
            <rect className="demo-node-tile" x={board.root.x + 12} y={board.root.y + 12} width={40} height={40} rx={11} />
            <Glyph kind="agent" x={board.root.x + 22} y={board.root.y + 22} size={20} />
            <text className="demo-node-name" x={board.root.x + 64} y={board.root.y + 29}>
              {AGENT}
            </text>
            <text className="demo-node-sub" x={board.root.x + 64} y={board.root.y + 47}>
              {MODEL}
            </text>
          </g>

          {[...board.channels, ...board.lower].map((node) =>
            node.kind === "subagent" ? (
              <g key={node.id} {...nodeProps(node)}>
                <rect className="demo-node-card" x={node.x} y={node.y} width={node.w} height={node.h} rx={13} />
                <rect className="demo-node-tile" x={node.x + 10} y={node.y + 10} width={32} height={32} rx={9} />
                <Glyph kind={node.kind} x={node.x + 16} y={node.y + 16} size={20} />
                <text className="demo-node-name" x={node.x + 52} y={node.y + 31}>
                  {node.name}
                </text>
              </g>
            ) : (
              <g key={node.id} {...nodeProps(node)}>
                <rect className="demo-node-card" x={node.x} y={node.y} width={TILE} height={TILE} rx={node.kind === "channel" ? 15 : TILE / 2} />
                <Glyph kind={node.kind} x={node.cx - 11} y={node.y + TILE / 2 - 11} size={22} />
                {/* Channels sit above the agent with wires below them, so their names go on top. */}
                <text className="demo-node-label" x={node.cx} y={node.kind === "channel" ? node.y - 10 : node.y + TILE + 20} textAnchor="middle">
                  {node.name}
                </text>
              </g>
            ),
          )}
        </svg>

        {added.length === 0 ? (
          <p className="demo-hint">
            <i aria-hidden="true" />
            Drag a piece onto {AGENT}, or click one to add it
          </p>
        ) : (
          <div className="demo-footer">
            <p className="demo-status">
              {files.length} files, the same code EveLab writes in your project
            </p>
            <button type="button" className="demo-reset" onClick={reset}>
              <Icon icon={IconRotateCounterClockwise} size={13} />
              Reset
            </button>
          </div>
        )}
      </div>

      <div className="demo-code">
        <ul className="demo-tree" aria-label="Project files">
          {rows.map((row) =>
            row.dir ? (
              <li key={row.path} className="demo-tree-row" data-dir="" style={{ paddingInlineStart: 8 + row.depth * 14 }}>
                {row.name}/
              </li>
            ) : (
              <li key={row.path}>
                <button
                  type="button"
                  className="demo-tree-row"
                  style={{ paddingInlineStart: 8 + row.depth * 14 }}
                  aria-current={row.path === current.path || undefined}
                  onClick={() => setSelected(row.path)}
                >
                  {row.name}
                  {row.path === latestPath && <span className="demo-tree-new">new</span>}
                </button>
              </li>
            ),
          )}
        </ul>
        <div className="demo-file-head">
          <span className="demo-file-path">{current.path}</span>
          <button type="button" className="demo-copy" onClick={copy}>
            <Icon icon={copied ? IconCheck : IconCopy} size={13} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="demo-pre" key={current.path}>
          <code>
            {current.content
              .replace(/\n$/, "")
              .split("\n")
              .map((line, index) => (
                <span className="demo-line" key={index}>
                  <span className="demo-line-no">{index + 1}</span>
                  <span>{highlight(line, current.path.endsWith(".md"))}</span>
                </span>
              ))}
          </code>
        </pre>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
