"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { EASE_OUT } from "@/components/interaction";

interface Command {
  label: string;
  hint: string;
  href: string;
}

/** ⌘K navigation. Added early because the sidebar only gets longer. */
export function CommandPalette({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const base = `/projects/${projectId}`;
    return [
      { label: "Open canvas", hint: "Visual editor", href: `${base}/canvas` },
      { label: "Open overview", hint: "Project", href: base },
      { label: "Edit instructions", hint: "instructions.md", href: `${base}/agent/instructions` },
      { label: "Configure model", hint: "agent.ts", href: `${base}/agent/model` },
      { label: "Add tool", hint: "tools/", href: `${base}/tools` },
      { label: "Import skill", hint: "skills/", href: `${base}/skills` },
      { label: "Create subagent", hint: "subagents/", href: `${base}/subagents` },
      { label: "Open agent.ts", hint: "Files", href: `${base}/files?path=agent.ts` },
      { label: "Browse files", hint: "Files", href: `${base}/files` },
      { label: "View runs", hint: "Observe", href: `${base}/runs` },
      { label: "View deployments", hint: "Deploy", href: `${base}/deployments` },
      { label: "Project settings", hint: "Settings", href: `${base}/settings` },
      { label: "All projects", hint: "Switch", href: "/projects" },
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <motion.div
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Commands"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={EASE_OUT}
          >
            <input
              ref={inputRef}
              className="input palette-input"
              placeholder="Search commands"
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
              {results.map((command, index) => (
                <li key={command.href}>
                  <button
                    type="button"
                    className="palette-item"
                    data-active={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(command.href)}
                  >
                    <span>{command.label}</span>
                    <span className="palette-hint">{command.hint}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="palette-item palette-hint">No matching command</li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
