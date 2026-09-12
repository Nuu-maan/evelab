"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Bot,
  File,
  Files,
  FileText,
  LayoutGrid,
  Rocket,
  Settings,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

interface Command {
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
}

const OPEN_EVENT = "evelab:command-palette";

/** Opens the palette from anywhere, such as the sidebar's Find button. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * ⌘K navigation. It opens and closes instantly: something summoned from the
 * keyboard many times a day should never make the user wait for an animation.
 */
export function CommandPalette({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const commands = useMemo<Command[]>(() => {
    const base = `/projects/${projectId}`;
    return [
      { label: "Open canvas", hint: "Visual editor", href: `${base}/canvas`, icon: Workflow },
      { label: "Open overview", hint: "Project", href: base, icon: LayoutGrid },
      {
        label: "Edit instructions",
        hint: "instructions.md",
        href: `${base}/agent/instructions`,
        icon: FileText,
      },
      { label: "Configure model", hint: "agent.ts", href: `${base}/agent/model`, icon: Bot },
      { label: "Add tool", hint: "tools/", href: `${base}/tools`, icon: Wrench },
      { label: "Import skill", hint: "skills/", href: `${base}/skills`, icon: BookOpen },
      { label: "Create subagent", hint: "subagents/", href: `${base}/subagents`, icon: Users },
      { label: "Open agent.ts", hint: "Files", href: `${base}/files?path=agent.ts`, icon: File },
      { label: "Browse files", hint: "Files", href: `${base}/files`, icon: Files },
      { label: "View runs", hint: "Observe", href: `${base}/runs`, icon: Activity },
      { label: "View deployments", hint: "Deploy", href: `${base}/deployments`, icon: Rocket },
      { label: "Project settings", hint: "Settings", href: `${base}/settings`, icon: Settings },
      { label: "All projects", hint: "Switch", href: "/projects", icon: ArrowUpRight },
    ];
  }, [projectId]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    } else {
      returnFocus.current?.focus();
      returnFocus.current = null;
    }
  }, [open]);

  const go = (href: string) => {
    returnFocus.current = null;
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Commands">
        <input
          ref={inputRef}
          className="input palette-input"
          placeholder="Search commands"
          aria-label="Search commands"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((value) => Math.min(value + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(value - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const target = results[active];
              if (target) go(target.href);
            }
          }}
        />
        <ul className="palette-list">
          {results.map(({ label, hint, href, icon: Icon }, index) => (
            <li key={href}>
              <button
                type="button"
                className="palette-item"
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(href)}
              >
                <Icon aria-hidden="true" strokeWidth={1.5} />
                <span className="palette-item-label">{label}</span>
                <span className="palette-hint">{hint}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="palette-item palette-hint">No matching command</li>}
        </ul>
      </div>
    </div>
  );
}
