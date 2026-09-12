"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";
import { EASE_OUT, EXIT } from "@/components/interaction";

export interface SwitcherProject {
  id: string;
  name: string;
}

export function Avatar({ name, size }: { name: string; size?: "large" }) {
  return (
    <span className="avatar" data-size={size} aria-hidden="true">
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

/** The project name at the top of the sidebar doubles as the way to switch. */
export function ProjectSwitcher({
  current,
  projects,
}: {
  current: SwitcherProject;
  projects: SwitcherProject[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    menu.current?.querySelector<HTMLElement>('[aria-current="true"], [role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const target =
      event.key === "ArrowDown"
        ? items[(index + 1) % items.length]
        : event.key === "ArrowUp"
          ? items[(index - 1 + items.length) % items.length]
          : event.key === "Home"
            ? items[0]
            : event.key === "End"
              ? items.at(-1)
              : undefined;
    if (event.key === "Tab") setOpen(false);
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  return (
    <div className="switcher" ref={root}>
      <button
        ref={trigger}
        className="switcher-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Avatar name={current.name} />
        <span className="switcher-name">{current.name}</span>
        <ChevronsUpDown className="switcher-chevron" aria-hidden="true" strokeWidth={1.5} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            className="menu"
            role="menu"
            aria-label="Switch project"
            onKeyDown={onMenuKeyDown}
            initial={{ opacity: 0, transform: "scale(0.97)" }}
            animate={{ opacity: 1, transform: "scale(1)", transition: EASE_OUT }}
            exit={{ opacity: 0, transform: "scale(0.99)", transition: EXIT }}
          >
            <p className="menu-label">Projects</p>
            {projects.map((project) => (
              <Link
                key={project.id}
                className="menu-item"
                role="menuitem"
                href={`/projects/${project.id}`}
                aria-current={project.id === current.id ? "true" : undefined}
                onClick={() => setOpen(false)}
              >
                <Avatar name={project.name} />
                <span className="menu-item-label">{project.name}</span>
                {project.id === current.id && <Check aria-hidden="true" strokeWidth={1.5} />}
              </Link>
            ))}
            <hr className="menu-separator" />
            <Link className="menu-item" role="menuitem" href="/projects" onClick={() => setOpen(false)}>
              <LayoutGrid aria-hidden="true" strokeWidth={1.5} />
              <span className="menu-item-label">All projects</span>
            </Link>
            <Link
              className="menu-item"
              role="menuitem"
              href="/projects/new"
              onClick={() => setOpen(false)}
            >
              <Plus aria-hidden="true" strokeWidth={1.5} />
              <span className="menu-item-label">New project</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
