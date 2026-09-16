"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { IconPlus, IconMagnifyingGlass } from "@/components/icons";
import { Icon } from "@/components/icon";

export interface ProjectEntry {
  id: string;
  name: string;
  model: string;
  updatedAt: number;
  card: ReactNode;
}

type Sort = "updated" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "updated", label: "Recent" },
  { value: "name", label: "Name" },
];

/** The project grid with a filter and a sort, so a long workspace stays findable. */
export function ProjectsBrowser({ projects }: { projects: ProjectEntry[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const deferred = useDeferredValue(query);

  const shown = useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    const matches = needle
      ? projects.filter((project) =>
          [project.name, project.id, project.model].some((value) => value.toLowerCase().includes(needle)),
        )
      : projects;
    return [...matches].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt));
  }, [deferred, projects, sort]);

  return (
    <div className="projects">
      <div className="projects-toolbar">
        <label className="projects-search">
          <Icon icon={IconMagnifyingGlass} size={14} />
          <span className="visually-hidden">Filter projects</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, id or model"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="projects-sort" role="radiogroup" aria-label="Sort projects">
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={sort === option.value}
              className="projects-sort-option"
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="projects-count" aria-live="polite">
          {shown.length === projects.length ? projects.length : `${shown.length}/${projects.length}`}
          {projects.length === 1 ? " project" : " projects"}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="projects-empty">
          Nothing matches <span className="mono">{deferred}</span>.
        </p>
      ) : (
        <ul className="projects-grid">
          {shown.map((project) => (
            <li key={project.id}>{project.card}</li>
          ))}
          {!deferred && (
            <li>
              <Link className="project-new" href="/projects/new">
                <span className="project-new-mark">
                  <Icon icon={IconPlus} />
                </span>
                <span className="card-title">New project</span>
                <span className="project-new-hint">Start from a blank agent</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
