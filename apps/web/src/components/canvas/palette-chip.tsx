"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { CanvasNodeKind } from "@evelab/eve-project";
import { KindTile } from "@/components/kinds";

export interface PaletteItem {
  kind: CanvasNodeKind;
  title: string;
  detail: string;
}

type Point = { x: number; y: number };

/** Pixels the pointer must travel before a press becomes a drag, so a click stays a click. */
const DRAG_THRESHOLD = 4;
/** Degrees of tilt at full speed. Enough to read as weight, not as a spin. */
const MAX_TILT = 9;
/** Tilt per px/ms of horizontal pointer speed. */
const TILT_PER_SPEED = 12;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * A palette chip you can pick up. The preview follows the pointer and leans
 * into horizontal movement through a spring, so it feels carried rather than
 * teleported; it straightens when the pointer rests. Dropped on the canvas it
 * settles in place; dropped anywhere else it flies back to the palette.
 *
 * Pointer events instead of native drag and drop: the browser's drag image is
 * a static bitmap that cannot tilt, scale or animate.
 */
export function PaletteChip({
  item,
  onActivate,
  canDrop,
  onDrop,
  onHoverDrop,
}: {
  item: PaletteItem;
  /** Click or Enter: open the create form without choosing a position. */
  onActivate: () => void;
  canDrop: (point: Point) => boolean;
  onDrop: (point: Point) => void;
  onHoverDrop: (over: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(1);
  const lean = useMotionValue(0);
  const rotate = useSpring(lean, { stiffness: 420, damping: 28, mass: 0.7 });
  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`;

  const [ghost, setGhost] = useState<{ width: number; height: number }>();
  const [over, setOver] = useState(false);
  const drag = useRef<{
    start: Point;
    offset: Point;
    origin: Point;
    width: number;
    height: number;
    lastX: number;
    lastTime: number;
    active: boolean;
  }>(undefined);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suppressClick = useRef(false);

  useEffect(() => () => clearTimeout(settle.current), []);

  const overRef = useRef(false);
  // Plain comparison against a ref: telling the canvas from inside a state updater
  // would update another component while this one renders.
  const setOverState = (next: boolean) => {
    if (overRef.current === next) return;
    overRef.current = next;
    setOver(next);
    onHoverDrop(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      start: { x: event.clientX, y: event.clientY },
      offset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      origin: { x: rect.left, y: rect.top },
      width: rect.width,
      height: rect.height,
      lastX: event.clientX,
      lastTime: performance.now(),
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    if (!state.active) {
      if (Math.hypot(event.clientX - state.start.x, event.clientY - state.start.y) < DRAG_THRESHOLD) return;
      state.active = true;
      suppressClick.current = true;
      x.set(state.origin.x);
      y.set(state.origin.y);
      opacity.set(1);
      scale.set(1);
      setGhost({ width: state.width, height: state.height });
      document.body.dataset.paletteDragging = "";
      // A lift on pickup: the chip comes toward you.
      void animate(scale, 1.05, { duration: 0.18, ease: EASE_OUT });
    }

    x.set(event.clientX - state.offset.x);
    y.set(event.clientY - state.offset.y);

    if (!reduceMotion) {
      const now = performance.now();
      const speed = (event.clientX - state.lastX) / Math.max(8, now - state.lastTime);
      state.lastX = event.clientX;
      state.lastTime = now;
      lean.set(Math.max(-MAX_TILT, Math.min(MAX_TILT, speed * TILT_PER_SPEED)));
      // When the pointer rests, the chip straightens.
      clearTimeout(settle.current);
      settle.current = setTimeout(() => lean.set(0), 70);
    }
    setOverState(canDrop({ x: event.clientX, y: event.clientY }));
  };

  const finish = async (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = drag.current;
    drag.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!state?.active) return;

    clearTimeout(settle.current);
    lean.set(0);
    delete document.body.dataset.paletteDragging;
    const point = { x: event.clientX, y: event.clientY };
    const landed = !cancelled && canDrop(point);
    setOverState(false);

    if (landed) {
      onDrop(point);
      // Settles into the canvas: a small press and a quick fade, as if set down.
      await Promise.all([
        animate(scale, 0.94, { duration: 0.16, ease: EASE_OUT }),
        animate(opacity, 0, { duration: 0.16, ease: EASE_OUT }),
      ]);
    } else if (reduceMotion) {
      await animate(opacity, 0, { duration: 0.12 });
    } else {
      // Missed the canvas: back to where it came from, with a little momentum.
      await Promise.all([
        animate(x, state.origin.x, { type: "spring", duration: 0.35, bounce: 0.15 }),
        animate(y, state.origin.y, { type: "spring", duration: 0.35, bounce: 0.15 }),
        animate(scale, 1, { duration: 0.2, ease: EASE_OUT }),
      ]);
    }
    setGhost(undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <>
      <div
        className="palette-chip"
        data-kind={item.kind}
        data-lifted={ghost ? "" : undefined}
        role="button"
        tabIndex={0}
        aria-label={`${item.title}: ${item.detail}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => void finish(event, false)}
        onPointerCancel={(event) => void finish(event, true)}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onActivate();
        }}
        onKeyDown={onKeyDown}
      >
        <KindTile kind={item.kind} />
        <span className="palette-chip-text">
          <span className="palette-chip-title">{item.title}</span>
          <span className="palette-chip-detail mono">{item.detail}</span>
        </span>
      </div>

      {ghost &&
        createPortal(
          <motion.div
            className="palette-chip drag-ghost"
            data-kind={item.kind}
            data-over={over || undefined}
            aria-hidden="true"
            style={{ width: ghost.width, height: ghost.height, transform, opacity }}
          >
            <KindTile kind={item.kind} />
            <span className="palette-chip-text">
              <span className="palette-chip-title">{item.title}</span>
              <span className="palette-chip-detail mono">{over ? "Release to add" : item.detail}</span>
            </span>
          </motion.div>,
          document.body,
        )}
    </>
  );
}
