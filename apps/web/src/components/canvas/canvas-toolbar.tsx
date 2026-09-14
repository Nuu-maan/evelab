"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
  IconHand,
  IconLockClosed,
  IconLockOpen,
  IconPlus,
  IconPointer,
  IconSquareDashed,
  IconStickyNote,
} from "@/components/icons";
import type { CreateKind } from "@/components/canvas/canvas-inspector";
import { Icon, type IconData } from "@/components/icon";
import { KINDS, KindTile } from "@/components/kinds";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type CanvasTool = "select" | "hand";
export type PieceKind = CreateKind | "note" | "section";
type Point = { x: number; y: number };

export const PICKER_WIDTH = 300;
/** The kinds in toolbar order, so 1 to 5 pick them from the keyboard. */
export const PIECE_ORDER: CreateKind[] = ["subagent", "tool", "skill", "connection", "channel"];

const DRAG_THRESHOLD = 4;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface Piece {
  kind: PieceKind;
  key: string;
  label: string;
  icon: IconData;
  hint: string;
}

const PIECES: Piece[] = [
  ...PIECE_ORDER.map((kind, index) => ({
    kind,
    key: String(index + 1),
    label: KINDS[kind].label,
    icon: KINDS[kind].icon,
    hint: {
      subagent: "an agent that takes delegated work",
      tool: "a function the model calls",
      skill: "instructions loaded on demand",
      connection: "an MCP server or OpenAPI service",
      channel: "Slack, HTTP, Chat SDK and more",
    }[kind],
  })),
];

const ANNOTATIONS: Piece[] = [
  { kind: "note", key: "6", label: "Note", icon: IconStickyNote, hint: "handwritten text" },
  { kind: "section", key: "7", label: "Section", icon: IconSquareDashed, hint: "a frame that groups cards" },
];

export function isAnnotationPiece(kind: PieceKind): kind is "note" | "section" {
  return kind === "note" || kind === "section";
}

function pieceHint(piece: Piece): string {
  return isAnnotationPiece(piece.kind)
    ? `${piece.label}: ${piece.hint}. Drag it onto the canvas, or press ${piece.key}.`
    : `${piece.label}: ${piece.hint}. Drag it onto an agent, or press ${piece.key} to pick one.`;
}

/**
 * A toolbar piece you drag onto the board, as shapes come off Excalidraw's
 * toolbar. A small tile follows the pointer and says where it will land; a
 * click does the same thing without choosing a place.
 */
function PieceButton({
  piece,
  onHint,
  describeDrop,
  onDrop,
  onActivate,
  onDragEnd,
}: {
  piece: Piece;
  onHint: (hint?: string) => void;
  describeDrop: (kind: PieceKind, point: Point) => string | undefined;
  onDrop: (kind: PieceKind, point: Point) => void;
  onActivate: (kind: PieceKind, anchor: DOMRect) => void;
  onDragEnd: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(1);
  const [ghost, setGhost] = useState(false);
  const [label, setLabel] = useState<string>();
  const drag = useRef<{ start: Point; home: Point; active: boolean }>(undefined);
  const suppressClick = useRef(false);
  const kind = isAnnotationPiece(piece.kind) ? undefined : piece.kind;

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      start: { x: event.clientX, y: event.clientY },
      home: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    const point = { x: event.clientX, y: event.clientY };
    if (!state.active) {
      if (Math.hypot(point.x - state.start.x, point.y - state.start.y) < DRAG_THRESHOLD) return;
      state.active = true;
      suppressClick.current = true;
      opacity.set(1);
      scale.set(0.7);
      setGhost(true);
      document.body.dataset.paletteDragging = "";
      void animate(scale, 1, { duration: 0.18, ease: EASE_OUT });
    }
    x.set(point.x);
    y.set(point.y);
    const next = describeDrop(piece.kind, point);
    setLabel((current) => (current === next ? current : next));
  };

  const finish = async (event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const state = drag.current;
    drag.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!state?.active) return;
    delete document.body.dataset.paletteDragging;
    const point = { x: event.clientX, y: event.clientY };
    const landed = !cancelled && describeDrop(piece.kind, point) !== undefined;
    onDragEnd();
    setLabel(undefined);

    if (landed) {
      onDrop(piece.kind, point);
      await Promise.all([
        animate(scale, 0.6, { duration: 0.16, ease: EASE_OUT }),
        animate(opacity, 0, { duration: 0.16, ease: EASE_OUT }),
      ]);
    } else if (reduceMotion) {
      await animate(opacity, 0, { duration: 0.12 });
    } else {
      // Missed the board: back into the toolbar.
      await Promise.all([
        animate(x, state.home.x, { type: "spring", duration: 0.35, bounce: 0.15 }),
        animate(y, state.home.y, { type: "spring", duration: 0.35, bounce: 0.15 }),
        animate(scale, 0.6, { duration: 0.3, ease: EASE_OUT }),
        animate(opacity, 0, { duration: 0.2, delay: 0.15 }),
      ]);
    }
    setGhost(false);
  };

  return (
    <>
      <button
        type="button"
        className="tool-button"
        data-kind={kind}
        data-lifted={ghost || undefined}
        aria-label={`${piece.label}: ${piece.hint}`}
        aria-keyshortcuts={piece.key}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => void finish(event, false)}
        onPointerCancel={(event) => void finish(event, true)}
        onPointerEnter={() => onHint(pieceHint(piece))}
        onPointerLeave={() => onHint(undefined)}
        onFocus={() => onHint(pieceHint(piece))}
        onBlur={() => onHint(undefined)}
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onActivate(piece.kind, event.currentTarget.getBoundingClientRect());
        }}
      >
        <Icon icon={piece.icon} />
        <span className="tool-key" aria-hidden="true">
          {piece.key}
        </span>
      </button>

      {ghost &&
        createPortal(
          <motion.div
            className="tool-ghost"
            data-kind={kind}
            data-over={label ? "" : undefined}
            aria-hidden="true"
            style={{ x, y, scale, opacity }}
          >
            <span className="tool-ghost-tile">
              <Icon icon={piece.icon} />
            </span>
            <span className="tool-ghost-label">{label ?? piece.label}</span>
          </motion.div>,
          document.body,
        )}
    </>
  );
}

function ModeButton({
  label,
  hint,
  shortcut,
  icon,
  pressed,
  tone,
  count,
  onHint,
  onClick,
}: {
  label: string;
  hint: string;
  shortcut?: string;
  icon: IconData;
  pressed: boolean;
  tone?: string;
  count?: ReactNode;
  onHint: (hint?: string) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tool-button"
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      data-tone={tone}
      onPointerEnter={() => onHint(hint)}
      onPointerLeave={() => onHint(undefined)}
      onFocus={() => onHint(hint)}
      onBlur={() => onHint(undefined)}
      onClick={onClick}
    >
      <Icon icon={icon} />
      {(shortcut || count !== undefined) && (
        <span className="tool-key" aria-hidden="true">
          {count ?? shortcut}
        </span>
      )}
    </button>
  );
}

/** The canvas toolbar: how the pointer behaves, and the pieces an architecture is built from. */
export function CanvasToolbar({
  tool,
  onTool,
  locked,
  onLock,
  describeDrop,
  onPieceDrop,
  onPieceActivate,
  onDragEnd,
}: {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  locked: boolean;
  onLock: () => void;
  describeDrop: (kind: PieceKind, point: Point) => string | undefined;
  onPieceDrop: (kind: PieceKind, point: Point) => void;
  onPieceActivate: (kind: PieceKind, anchor: DOMRect) => void;
  onDragEnd: () => void;
}) {
  const [hint, setHint] = useState<string>();
  const piece = (item: Piece) => (
    <PieceButton
      key={item.kind}
      piece={item}
      onHint={setHint}
      describeDrop={describeDrop}
      onDrop={onPieceDrop}
      onActivate={onPieceActivate}
      onDragEnd={onDragEnd}
    />
  );

  return (
    <div className="canvas-toolbar-wrap">
      <div className="canvas-float canvas-toolbar" role="toolbar" aria-label="Canvas tools">
        <div className="tool-group tool-group-optional">
          <ModeButton
            label={locked ? "Unlock canvas" : "Lock canvas"}
            hint={locked ? "Locked: cards stay where they are. Click to unlock." : "Lock the canvas so nothing moves by accident."}
            icon={locked ? IconLockClosed : IconLockOpen}
            pressed={locked}
            onHint={setHint}
            onClick={onLock}
          />
          <span className="tool-separator" aria-hidden="true" />
          <ModeButton
            label="Hand"
            hint="Hand: drag anywhere to pan the canvas."
            shortcut="H"
            icon={IconHand}
            pressed={tool === "hand"}
            onHint={setHint}
            onClick={() => onTool("hand")}
          />
          <ModeButton
            label="Select"
            hint="Select: drag on empty canvas to select an area."
            shortcut="V"
            icon={IconPointer}
            pressed={tool === "select"}
            onHint={setHint}
            onClick={() => onTool("select")}
          />
          <span className="tool-separator" aria-hidden="true" />
        </div>
        {PIECES.map(piece)}
        <span className="tool-separator" aria-hidden="true" />
        {ANNOTATIONS.map(piece)}
      </div>
      <p className="canvas-toolbar-hint" aria-live="polite">
        {hint ??
          (tool === "hand" ? (
            <>
              Drag to pan. <kbd>V</kbd> to select
            </>
          ) : (
            <>
              Drag a piece onto an agent to add it. Hold <kbd>Space</kbd> to pan
            </>
          ))}
      </p>
    </div>
  );
}

export interface PickerOption {
  id: string;
  name: string;
  detail: string;
  shared?: boolean;
}

/** Asked after a piece lands: which existing one to add, or a new one. */
export function CanvasPicker({
  kind,
  targetName,
  at,
  options,
  onPick,
  onCreate,
  onClose,
}: {
  kind: CreateKind;
  targetName: string;
  at: Point;
  options: PickerOption[];
  onPick: (id: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  const { label, plural } = KINDS[kind];
  const noun = label.toLowerCase();

  return (
    <div
      ref={ref}
      className="canvas-float canvas-picker"
      style={{ insetInlineStart: at.x, top: at.y, width: PICKER_WIDTH }}
      role="dialog"
      aria-label={`Choose a ${noun}`}
    >
      <div className="canvas-picker-head">
        <KindTile kind={kind} />
        <div className="min-w-0">
          <p className="canvas-picker-title">Which {noun}?</p>
          <p className="canvas-picker-target">
            Adding to <span className="mono">{targetName}</span>
          </p>
        </div>
      </div>
      <Command loop>
        <CommandInput placeholder={`Search ${plural.toLowerCase()}`} autoFocus />
        <CommandList className="canvas-picker-list">
          <CommandEmpty>No {noun} by that name.</CommandEmpty>
          <CommandGroup heading={`Existing ${plural.toLowerCase()}`}>
            {options.map((option) => (
              <CommandItem key={option.id} value={`${option.name} ${option.id}`} onSelect={() => onPick(option.id)}>
                <KindTile kind={kind} />
                <span className="menu-text">
                  <span className="truncate">{option.name}</span>
                  <span className="menu-hint mono truncate">{option.detail}</span>
                </span>
                {option.shared && <span className="menu-meta">Shared</span>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup>
            <CommandItem value={`new ${noun}`} forceMount onSelect={onCreate}>
              <span className="kind-tile picker-new-tile" aria-hidden="true">
                <Icon icon={IconPlus} size={14} />
              </span>
              {kind === "skill" ? "Write or import a skill" : `New ${noun}`}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
