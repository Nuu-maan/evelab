"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { PANES, paneCookie, type PaneName } from "@/lib/pane-config";

/**
 * Drag handle on a pane edge.
 *
 * The width lives in a CSS custom property on the nearest `[data-panes]`
 * element, so dragging never re-renders React, and in a cookie, so the server
 * renders the same width next time. `edge="end"` sits on the right of a
 * left-hand pane; `edge="start"` on the left of a right-hand pane, where
 * dragging left makes it wider.
 */
export function ResizeHandle({
  pane,
  label,
  edge = "end",
}: {
  pane: PaneName;
  label: string;
  edge?: "start" | "end";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number } | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState<number>();
  const bounds = PANES[pane];
  const direction = edge === "end" ? 1 : -1;

  const measure = () =>
    Math.round(ref.current?.parentElement?.getBoundingClientRect().width ?? bounds.initial);

  useEffect(() => {
    setWidth(Math.round(ref.current?.parentElement?.getBoundingClientRect().width ?? 0));
  }, []);

  const apply = (next: number): number => {
    const clamped = Math.round(Math.min(bounds.max, Math.max(bounds.min, next)));
    ref.current
      ?.closest<HTMLElement>("[data-panes]")
      ?.style.setProperty(`--pane-${pane}`, `${clamped}px`);
    return clamped;
  };

  const commit = () => {
    const next = measure();
    setWidth(next);
    document.cookie = `${paneCookie(pane)}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width: measure() };
    document.body.dataset.resizing = "";
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    apply(start.width + (event.clientX - start.x) * direction);
  };

  const onPointerEnd = () => {
    if (!drag.current) return;
    drag.current = undefined;
    delete document.body.dataset.resizing;
    setDragging(false);
    commit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 64 : 16;
    const current = measure();
    const next =
      event.key === "ArrowRight"
        ? current + step * direction
        : event.key === "ArrowLeft"
          ? current - step * direction
          : event.key === "Home"
            ? bounds.min
            : event.key === "End"
              ? bounds.max
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    apply(next);
    commit();
  };

  return (
    <div
      ref={ref}
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={width}
      tabIndex={0}
      data-edge={edge}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      onDoubleClick={() => {
        apply(bounds.initial);
        commit();
      }}
    />
  );
}
