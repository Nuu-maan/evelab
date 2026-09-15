"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  renderAgentConfig,
  renderChannelModule,
  renderConnectionModule,
  renderToolModule,
} from "@evelab/eve-project/templates";
import { Icon } from "@/components/icon";
import { IconCheck, IconChevronDown, IconDownload, IconLogoGithub, IconPlay } from "@/components/icons";
import { KINDS } from "@/components/kinds";
import { Mark } from "@/components/mark";
import "@/app/landing-tour.css";

/* The tour is drawn on a fixed 1200 by 720 stage, scaled to fit, and filmed by a moving camera. */
const W = 1200;
const H = 720;
const MODEL = "anthropic/claude-opus-5";

type PieceKind = "subagent" | "tool" | "skill" | "connection" | "channel";
type Point = { x: number; y: number };
type Camera = Point & { s: number };

const PALETTE: readonly PieceKind[] = ["subagent", "tool", "skill", "connection", "channel"];
const PALETTE_X = 100;
const paletteY = (kind: PieceKind) => 124 + PALETTE.indexOf(kind) * 46;

const AGENT = { x: 520, y: 344, w: 236, h: 64 };

interface Piece {
  id: string;
  kind: PieceKind;
  name: string;
  x: number;
  y: number;
  path: string;
  code: string;
}

/* Written by the same templates EveLab uses, so the tour shows the code a project really gets. */
const PIECES: readonly Piece[] = [
  {
    id: "search_docs",
    kind: "tool",
    name: "search_docs",
    x: 400,
    y: 520,
    path: "agent/tools/search_docs.ts",
    code: renderToolModule("Search the product documentation and help centre."),
  },
  {
    id: "github",
    kind: "connection",
    name: "github",
    x: 640,
    y: 520,
    path: "agent/connections/github.ts",
    code: renderConnectionModule({
      kind: "mcp",
      url: "https://api.githubcopilot.com/mcp/",
      description: "Repositories, issues and pull requests.",
      auth: "connect",
      connector: "github/support-desk",
    }),
  },
  {
    id: "slack",
    kind: "channel",
    name: "slack",
    x: 520,
    y: 168,
    path: "agent/channels/slack.ts",
    code: renderChannelModule({ kind: "slack", connector: "slack/support-desk" }),
  },
];

const CODE = new Map<string, string>([
  ["agent/agent.ts", renderAgentConfig(MODEL)],
  ...PIECES.map((piece) => [piece.path, piece.code] as [string, string]),
]);

interface Toast {
  icon: "zip" | "github" | "check";
  text: string;
}

interface Scene {
  ms: number;
  chapter: number;
  caption: string;
  camera: Camera;
  cursor: Point & { down?: boolean };
  drag?: PieceKind;
  over?: boolean;
  nodes: readonly string[];
  file: string;
  type?: boolean;
  menu?: boolean;
  hover?: "zip" | "github";
  toast?: Toast;
  /** The canvas before a repository is imported: no agent yet. */
  empty?: boolean;
  importOpen?: boolean;
  importText?: string;
  importHover?: boolean;
}

const CHAPTERS = ["Drag and drop", "Real code", "Export", "Import"] as const;
const REPO_NAME = "you/support-desk";

const FULL: Camera = { x: W / 2, y: H / 2, s: 1 };
const ZOOM_CANVAS: Camera = { x: 480, y: 400, s: 1.3 };
const ZOOM_CODE: Camera = { x: 786, y: 320, s: 1.45 };
const ZOOM_MENU: Camera = { x: 847, y: 212, s: 1.7 };
const EXPORT: Point = { x: 1122, y: 24 };
const ZIP: Point = { x: 1040, y: 72 };
const GITHUB: Point = { x: 1040, y: 116 };
const ZOOM_IMPORT: Camera = { x: 520, y: 370, s: 1.35 };
const IMPORT_INPUT: Point = { x: 560, y: 366 };
const IMPORT_BUTTON: Point = { x: 644, y: 410 };

/** The script: each scene is where everything should be when it ends; CSS moves between them. */
function buildScenes(): Scene[] {
  const scenes: Scene[] = [];
  let last: Scene = { ms: 0, chapter: 0, caption: "", camera: FULL, cursor: { x: 760, y: 640 }, nodes: [], file: "agent/agent.ts" };

  const push = (patch: Partial<Scene> & { ms: number }) => {
    last = {
      ...last,
      drag: undefined,
      over: undefined,
      type: undefined,
      menu: undefined,
      hover: undefined,
      toast: undefined,
      empty: undefined,
      importOpen: undefined,
      importText: undefined,
      importHover: undefined,
      ...patch,
      cursor: patch.cursor ?? { x: last.cursor.x, y: last.cursor.y },
    };
    scenes.push(last);
  };

  const dragIn = (piece: Piece, camera: Camera) => {
    const from = { x: PALETTE_X, y: paletteY(piece.kind) };
    const drop = { x: AGENT.x + 36, y: AGENT.y + 8 };
    push({ ms: 900, chapter: 0, caption: "Drag pieces onto an agent", cursor: from });
    push({ ms: 280, chapter: 0, caption: "Drag pieces onto an agent", cursor: { ...from, down: true }, drag: piece.kind });
    push({ ms: 1100, chapter: 0, caption: "Drag pieces onto an agent", cursor: { ...drop, down: true }, drag: piece.kind, over: true, camera });
    push({ ms: 800, chapter: 0, caption: "Drag pieces onto an agent", cursor: drop, nodes: [...last.nodes, piece.id], file: piece.path });
  };

  push({ ms: 1500, chapter: 0, caption: "Start with an agent" });
  dragIn(PIECES[0], ZOOM_CANVAS);
  push({ ms: 2600, chapter: 1, caption: "Every piece is a real file", camera: ZOOM_CODE, type: true });
  push({ ms: 1000, chapter: 1, caption: "Every piece is a real file", camera: ZOOM_CODE });
  push({ ms: 900, chapter: 0, caption: "Drag pieces onto an agent", camera: FULL });
  dragIn(PIECES[1], FULL);
  dragIn(PIECES[2], FULL);
  push({ ms: 2200, chapter: 1, caption: "Canvas and code stay in step", camera: ZOOM_CODE, type: true });
  push({ ms: 1400, chapter: 1, caption: "Canvas and code stay in step", camera: FULL });

  const exportTo = (caption: string, target: Point, hover: "zip" | "github", toast: Toast) => {
    push({ ms: 900, chapter: 2, caption, cursor: EXPORT });
    push({ ms: 650, chapter: 2, caption, cursor: { ...EXPORT, down: true }, camera: ZOOM_MENU, menu: true });
    push({ ms: 750, chapter: 2, caption, cursor: target, camera: ZOOM_MENU, menu: true, hover });
    push({ ms: 260, chapter: 2, caption, cursor: { ...target, down: true }, camera: ZOOM_MENU, menu: true, hover });
    push({ ms: 2000, chapter: 2, caption, camera: FULL, toast });
  };
  exportTo("Download your project", ZIP, "zip", { icon: "zip", text: "support-desk.zip downloaded, 12 files" });
  exportTo("Or push it to GitHub", GITHUB, "github", { icon: "github", text: "Pushed 12 files to you/support-desk" });
  push({ ms: 2000, chapter: 2, caption: "Run it anywhere with eve dev", toast: { icon: "check", text: "npm run dev" } });

  // Import: an empty canvas, a repository name typed in, and the graph drawn from its files.
  const importing = { chapter: 3, caption: "Import any Eve repo", nodes: [], file: "agent/agent.ts", camera: ZOOM_IMPORT, empty: true, importOpen: true };
  push({ ms: 1000, ...importing, importText: "", cursor: IMPORT_INPUT });
  for (const length of [4, 11, REPO_NAME.length]) push({ ms: 360, ...importing, importText: REPO_NAME.slice(0, length) });
  push({ ms: 800, ...importing, importText: REPO_NAME, cursor: IMPORT_BUTTON, importHover: true });
  push({ ms: 240, ...importing, importText: REPO_NAME, cursor: { ...IMPORT_BUTTON, down: true }, importHover: true });
  push({
    ms: 2800,
    chapter: 3,
    caption: "See its graph and code",
    camera: FULL,
    nodes: PIECES.map((piece) => piece.id),
    file: PIECES[1].path,
    cursor: { x: 760, y: 640 },
  });
  return scenes;
}

const SCENES = buildScenes();
const SUMMARY = SCENES.findIndex((scene) => scene.caption === "Canvas and code stay in step" && scene.camera === FULL);
const CHAPTER_START = CHAPTERS.map((_, chapter) => SCENES.findIndex((scene) => scene.chapter === chapter));
const CHAPTER_TOTAL = CHAPTERS.map((_, chapter) =>
  SCENES.filter((scene) => scene.chapter === chapter).reduce((sum, scene) => sum + scene.ms, 0),
);
/** For each scene, how much of each chapter has already played before it starts. */
const CHAPTER_DONE = SCENES.map((_, index) =>
  CHAPTERS.map((__, chapter) =>
    SCENES.slice(0, index)
      .filter((scene) => scene.chapter === chapter)
      .reduce((sum, scene) => sum + scene.ms, 0),
  ),
);

const TOKEN = /("(?:[^"\\]|\\.)*")|(\/\/.*$)|\b(import|from|export|default|async|await|return|const)\b/g;

function highlight(line: string): ReactNode {
  if (line === "") return " ";
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) out.push(line.slice(last, start));
    const className = match[1] ? "tour-tok-string" : match[2] ? "tour-tok-comment" : "tour-tok-key";
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

function ToastIcon({ icon }: { icon: Toast["icon"] }) {
  if (icon === "zip") return <Icon icon={IconDownload} size={15} />;
  if (icon === "github") return <Icon icon={IconLogoGithub} size={15} />;
  return <Icon icon={IconCheck} size={15} />;
}

/**
 * The landing page's tour: a short, looping film of EveLab at work. A cursor
 * drags pieces onto an agent, the camera moves in to the code they write, and
 * the project is downloaded and pushed to GitHub. It pauses off screen and
 * holds a single frame for people who prefer less motion.
 */
export function LandingTour() {
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const typedRef = useRef<number | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [fit, setFit] = useState(0);
  const [typed, setTyped] = useState<number>();

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setFit(entry.contentRect.width / W));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const active = playing && visible && !reduced;

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % SCENES.length), SCENES[index].ms);
    return () => clearTimeout(timer);
  }, [active, index]);

  // Progress bars and typing follow the clock directly, without re-rendering the whole stage each frame.
  useEffect(() => {
    const scene = SCENES[index];
    const code = CODE.get(scene.file) ?? "";
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = active ? Math.min(1, (now - started) / scene.ms) : 1;
      CHAPTERS.forEach((_, chapter) => {
        const bar = bars.current[chapter];
        if (!bar) return;
        const done = CHAPTER_DONE[index][chapter] + (scene.chapter === chapter ? scene.ms * progress : 0);
        bar.style.transform = `scaleX(${Math.min(1, done / CHAPTER_TOTAL[chapter])})`;
      });
      const next = scene.type && active ? Math.min(code.length, Math.floor((progress / 0.75) * code.length)) : undefined;
      if (next !== typedRef.current) {
        typedRef.current = next;
        setTyped(next);
      }
      if (active && progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, index]);

  const scene = reduced ? SCENES[SUMMARY] : SCENES[index];
  const on = new Set(scene.nodes);
  const code = CODE.get(scene.file) ?? "";
  const shown = typed === undefined ? code : code.slice(0, typed);
  const files = ["agent/agent.ts", "agent/instructions.md", ...PIECES.filter((piece) => on.has(piece.id)).map((piece) => piece.path), "package.json"].sort();
  const { camera, cursor } = scene;
  const moveMs = Math.round(Math.min(scene.ms * 0.8, 900));

  return (
    <div className="tour" ref={root}>
      <div className="tour-viewport" ref={viewport} role="img" aria-label="A looping tour of EveLab: pieces dragged onto an agent, the code they write, the project exported to a zip and to GitHub, and a GitHub repository imported as a graph">
        <div className="tour-fit" style={{ transform: `scale(${fit})`, visibility: fit ? "visible" : "hidden" }} aria-hidden="true">
          <div
            className="tour-camera"
            style={{ transform: `translate(${W / 2}px, ${H / 2}px) scale(${camera.s}) translate(${-camera.x}px, ${-camera.y}px)` }}
          >
            <div className="tour-app">
              <div className="tour-bar">
                <Mark />
                <span className="tour-crumb">support-desk</span>
                <span className="tour-muted">/</span>
                <span className="tour-muted">Canvas</span>
                <span className="tour-export" data-pressed={scene.menu || undefined}>
                  <Icon icon={IconDownload} size={13} />
                  Export
                  <Icon icon={IconChevronDown} size={12} />
                </span>
              </div>

              <div className="tour-palette">
                <span className="tour-palette-label">Pieces</span>
                {PALETTE.map((kind) => (
                  <span key={kind} className="tour-piece" data-kind={kind} data-picked={scene.drag === kind || undefined} style={{ top: paletteY(kind) - 18 }}>
                    <span className="tour-piece-icon">
                      <Icon icon={KINDS[kind].icon} size={14} />
                    </span>
                    {KINDS[kind].label}
                  </span>
                ))}
              </div>

              <div className="tour-canvas">
                <svg className="tour-dots">
                  <pattern id="tour-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="1" fill="currentColor" />
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#tour-dots)" />
                </svg>
              </div>

              <svg className="tour-wires" viewBox={`0 0 ${W} ${H}`}>
                {PIECES.map((piece) => {
                  const d =
                    piece.kind === "channel"
                      ? `M ${AGENT.x} ${AGENT.y - AGENT.h / 2} C ${AGENT.x} ${AGENT.y - 80}, ${piece.x} ${piece.y + 80}, ${piece.x} ${piece.y + 26}`
                      : `M ${AGENT.x} ${AGENT.y + AGENT.h / 2} C ${AGENT.x} ${AGENT.y + 96}, ${piece.x} ${piece.y - 90}, ${piece.x} ${piece.y - 26}`;
                  return <path key={piece.id} className="tour-wire" data-kind={piece.kind} data-on={on.has(piece.id) || undefined} pathLength={1} d={d} />;
                })}
              </svg>

              <div
                className="tour-agent"
                data-over={scene.over || undefined}
                data-hidden={scene.empty || undefined}
                style={{ left: AGENT.x - AGENT.w / 2, top: AGENT.y - AGENT.h / 2, width: AGENT.w, height: AGENT.h }}
              >
                <span className="tour-agent-icon">
                  <Icon icon={KINDS.agent.icon} size={18} />
                </span>
                <span className="tour-agent-text">
                  <span className="tour-agent-name">support-desk</span>
                  <span className="tour-agent-model">{MODEL.slice(MODEL.indexOf("/") + 1)}</span>
                </span>
              </div>

              {PIECES.map((piece) => (
                <div
                  key={piece.id}
                  className="tour-node"
                  data-kind={piece.kind}
                  data-on={on.has(piece.id) || undefined}
                  style={{ left: piece.x - 26, top: piece.y - 26 }}
                >
                  <span className="tour-node-tile">
                    <Icon icon={KINDS[piece.kind].icon} size={20} />
                  </span>
                  <span className="tour-node-label">{piece.name}</span>
                </div>
              ))}

              <div className="tour-toast" data-on={scene.toast ? "" : undefined}>
                {scene.toast && (
                  <>
                    <ToastIcon icon={scene.toast.icon} />
                    {scene.toast.icon === "check" ? <code>{scene.toast.text}</code> : scene.toast.text}
                  </>
                )}
              </div>

              <div className="tour-code">
                <span className="tour-code-label">Files</span>
                <ul className="tour-tree">
                  {files.map((path) => (
                    <li key={path} data-current={path === scene.file || undefined}>
                      {path}
                    </li>
                  ))}
                </ul>
                <div className="tour-file">
                  <span>{scene.file}</span>
                  {scene.type && <span className="tour-writing">Writing</span>}
                </div>
                <pre className="tour-pre">
                  <code>
                    {shown
                      .replace(/\n$/, "")
                      .split("\n")
                      .map((line, number) => (
                        <span className="tour-line" key={number}>
                          <span className="tour-line-no">{number + 1}</span>
                          <span>{highlight(line)}</span>
                        </span>
                      ))}
                  </code>
                </pre>
              </div>

              <div className="tour-menu" data-open={scene.menu || undefined}>
                <span className="tour-menu-item" data-hover={scene.hover === "zip" || undefined}>
                  <Icon icon={IconDownload} size={15} />
                  <span>
                    Download ZIP
                    <small>Every project file, ready for eve dev</small>
                  </span>
                </span>
                <span className="tour-menu-item" data-hover={scene.hover === "github" || undefined}>
                  <Icon icon={IconLogoGithub} size={15} />
                  <span>
                    Push to GitHub
                    <small>Commit to a new or existing repository</small>
                  </span>
                </span>
              </div>

              <div className="tour-import" data-open={scene.importOpen || undefined}>
                <span className="tour-import-title">
                  <Icon icon={IconLogoGithub} size={15} />
                  Import from GitHub
                </span>
                <span className="tour-import-input">
                  {/* Keeps the typed name while the dialog fades out, instead of flashing the placeholder. */}
                  {scene.importOpen ? scene.importText || <span className="tour-muted">owner/name</span> : REPO_NAME}
                  <i className="tour-caret" />
                </span>
                <span className="tour-import-button" data-hover={scene.importHover || undefined}>
                  Import
                </span>
              </div>
            </div>

            {!reduced && (
              <div
                className="tour-cursor"
                data-down={cursor.down || undefined}
                style={{ transform: `translate(${cursor.x}px, ${cursor.y}px) scale(${1 / camera.s})`, transitionDuration: `${moveMs}ms` }}
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path d="M4 2.5 20 11l-7 1.8L9.4 20z" />
                </svg>
                <span className="tour-drag" data-kind={scene.drag} data-on={scene.drag ? "" : undefined}>
                  {scene.drag && (
                    <>
                      <Icon icon={KINDS[scene.drag].icon} size={14} />
                      {KINDS[scene.drag].label}
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <p className="tour-caption" key={scene.caption} aria-live="polite">
          <span>{scene.chapter + 1}</span>
          {scene.caption}
        </p>
      </div>

      {!reduced && (
        <div className="tour-controls">
          <button type="button" className="tour-play" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause the tour" : "Play the tour"}>
            {playing ? (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
                <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
              </svg>
            ) : (
              <Icon icon={IconPlay} size={14} />
            )}
          </button>
          {CHAPTERS.map((label, chapter) => (
            <button
              key={label}
              type="button"
              className="tour-chapter"
              data-current={scene.chapter === chapter || undefined}
              onClick={() => {
                setIndex(CHAPTER_START[chapter]);
                setPlaying(true);
              }}
            >
              <span className="tour-chapter-track">
                <span
                  className="tour-chapter-fill"
                  ref={(element) => {
                    bars.current[chapter] = element;
                  }}
                />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
