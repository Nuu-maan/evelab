"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Drawer } from "vaul";

const PHONE = "(max-width: 640px)";

/** Whether a media query matches. False until mounted, so the server and first paint agree. */
export function useMediaQuery(media: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(media);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [media]);
  return matches;
}

/** True on a phone-sized screen, where side panels become bottom sheets. */
export function usePhone(): boolean {
  return useMediaQuery(PHONE);
}

/** Half height to glance at, nearly full to work in. */
const SNAPS = [0.55, 0.94];

/**
 * A side panel as a phone bottom sheet (Vaul): it rises from the bottom, drags
 * between half and nearly full height by its handle, and drags down to close.
 * It is not modal, so the canvas stays live above it, and only the handle
 * drags, so lists still scroll and pieces can still be dragged out of it. A
 * flick down, a long drag or a tap outside closes it, and the last content is kept while the
 * sheet slides away, so closing never jumps.
 */
export function PhoneSheet({
  open,
  onOpenChange,
  title,
  keepOpenOn,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Elements outside the sheet that a tap should not close it for, such as the controls it works with. */
  keepOpenOn?: string;
  children: ReactNode;
}) {
  const [snap, setSnap] = useState<number | string | null>(SNAPS[0]);
  const content = useRef<HTMLDivElement>(null);
  const last = useRef(children);
  if (open) last.current = children;

  useEffect(() => {
    if (open) setSnap(SNAPS[0]);
  }, [open]);

  // A tap outside closes the sheet, as a modal one would. Only a tap: a drag
  // is someone panning the board, and menus and dialogs opened from the sheet
  // are part of it.
  useEffect(() => {
    if (!open) return;
    let start: { x: number; y: number; time: number; target: Element } | undefined;
    const down = (event: PointerEvent) => {
      start = { x: event.clientX, y: event.clientY, time: event.timeStamp, target: event.target as Element };
    };
    const up = (event: PointerEvent) => {
      const tap = start;
      start = undefined;
      if (!tap || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10 || event.timeStamp - tap.time > 500) return;
      if (content.current?.contains(tap.target)) return;
      const inside = ["[data-radix-popper-content-wrapper]", "[role='dialog']", "[role='alertdialog']", "[role='menu']", keepOpenOn]
        .filter(Boolean)
        .join(", ");
      if (tap.target.closest?.(inside)) return;
      onOpenChange(false);
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
    };
  }, [open, onOpenChange, keepOpenOn]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={SNAPS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      modal={false}
      handleOnly
      // Vaul only closes a sheet with snap points on a flick. A slow drag that leaves
      // little of the sheet showing should close it too, rather than spring back.
      onRelease={() => {
        const top = content.current?.getBoundingClientRect().top;
        if (top !== undefined && window.innerHeight - top < window.innerHeight * 0.3) onOpenChange(false);
      }}
    >
      <Drawer.Portal>
        <Drawer.Content ref={content} className="phone-sheet" aria-describedby={undefined}>
          <Drawer.Handle className="phone-sheet-handle" />
          <Drawer.Title className="visually-hidden">{title}</Drawer.Title>
          <div className="phone-sheet-body">{last.current}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
