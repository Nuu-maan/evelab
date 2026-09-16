import type { ReactNode } from "react";
import { Mark } from "@/components/mark";
import { Skeleton } from "@/components/ui/skeleton";
// A loading state can arrive before the page that owns these styles, so it brings them along.
import "@/app/shell.css";
import "@/app/explorer.css";
import "@/app/graph-preview.css";

/*
 * Loading states for each kind of page, built from the same scaffolds the
 * pages use, so content lands where its placeholder was. They fade in after a
 * short delay, so a fast navigation never flashes them.
 */

function Loading({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={["loading", className].filter(Boolean).join(" ")} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}

/** A dot grid like the canvas's, drawn as a pattern. */
function Dots({ id, gap = 16 }: { id: string; gap?: number }) {
  return (
    <svg className="skeleton-dots" aria-hidden="true">
      <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse">
        <circle cx={gap / 2} cy={gap / 2} r="1" fill="currentColor" />
      </pattern>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function PageHeaderSkeleton({ actions = false }: { actions?: boolean }) {
  return (
    <header className="page-header">
      <div className="page-heading">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-1.5 h-7 w-44" />
        <Skeleton className="mt-1.5 h-4 w-80 max-w-full" />
      </div>
      {actions && (
        <div className="page-actions">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-28" />
        </div>
      )}
    </header>
  );
}

/** The top bar of pages outside a project, which needs no data to draw. */
export function PlainShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="plain-shell">
      <header className="topbar">
        <span className="topbar-brand">
          <Mark />
          EveLab
        </span>
        <div className="topbar-actions">
          <Skeleton className="size-8" />
          <Skeleton className="h-7 w-20" />
        </div>
      </header>
      <main className="main" id="main">
        {children}
      </main>
    </div>
  );
}

function ProjectCardSkeleton({ index }: { index: number }) {
  return (
    <div className="project-card">
      <div className="project-card-preview">
        <Dots id={`skeleton-card-dots-${index}`} />
        <span className="skeleton-card-graph" aria-hidden="true">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <span className="skeleton-card-tiles">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="size-6 rounded-full" />
          </span>
        </span>
      </div>
      <div className="project-card-body">
        <div className="project-card-heading">
          <div className="project-card-title">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-44" />
          </div>
        </div>
        <div className="project-card-parts">
          <Skeleton className="h-3 w-9" />
          <Skeleton className="h-3 w-9" />
          <Skeleton className="h-3 w-9" />
        </div>
      </div>
      <div className="project-card-footer">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <PlainShellSkeleton>
      <div className="page">
        <PageHeaderSkeleton actions />
        <Loading label="Loading projects" className="projects">
          <div className="projects-toolbar">
            <Skeleton className="h-9 w-[380px] max-w-full rounded-lg" />
            <Skeleton className="h-9 w-[124px] rounded-lg" />
          </div>
          <div className="projects-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <ProjectCardSkeleton key={index} index={index} />
            ))}
          </div>
        </Loading>
      </div>
    </PlainShellSkeleton>
  );
}

/** A form page such as creating or importing a project. */
export function FormPageSkeleton({ label }: { label: string }) {
  return (
    <PlainShellSkeleton>
      <div className="page page-narrow">
        <PageHeaderSkeleton />
        <Loading label={label} className="skeleton-panel skeleton-form">
          {[16, 20, 14].map((width, index) => (
            <span key={index} className="skeleton-field">
              <Skeleton className="h-3" style={{ width: `${width * 4}px` }} />
              <Skeleton className="h-9 w-full rounded-lg" />
            </span>
          ))}
          <span className="skeleton-form-actions">
            <Skeleton className="h-8 w-28" />
          </span>
        </Loading>
      </div>
    </PlainShellSkeleton>
  );
}

const SIDEBAR_GROUPS = [
  [56, 64, 44, 36, 96],
  [40, 36, 64, 80, 64, 68],
];

/** A project page with its shell: shown while the project itself is read. */
export function ProjectShellSkeleton() {
  return (
    <div className="shell">
      <aside className="sidebar" aria-hidden="true">
        <div className="sidebar-panel">
          <div className="sidebar-top">
            <span className="skeleton-row h-10">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-3.5 w-28" />
            </span>
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="sidebar-nav">
            {SIDEBAR_GROUPS.map((widths, group) => (
              <div key={group} className="sidebar-group">
                <span className="skeleton-row h-6">
                  <Skeleton className="h-2.5 w-14" />
                </span>
                {widths.map((width, index) => (
                  <span key={index} className="skeleton-row">
                    <Skeleton className="size-4 rounded" />
                    <Skeleton className="h-3" style={{ width }} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="header">
          <Skeleton className="ms-2 size-7" />
          <Skeleton className="h-3 w-48" />
          <span className="ms-auto flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-24" />
          </span>
        </header>
        <main className="main" id="main">
          <ProjectPageSkeleton />
        </main>
      </div>
    </div>
  );
}

/** The content of a project page: a header, a row of cards and a list. */
export function ProjectPageSkeleton() {
  return (
    <div className="page">
      <PageHeaderSkeleton actions />
      <Loading label="Loading page" className="skeleton-stack">
        <div className="skeleton-cards">
          {[0, 1, 2].map((index) => (
            <div key={index} className="skeleton-panel skeleton-card">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="mt-auto h-3.5 w-24" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
          ))}
        </div>
        <div className="skeleton-panel skeleton-list">
          {[44, 36, 52, 30, 40].map((width, index) => (
            <span key={index} className="skeleton-list-row">
              <Skeleton className="size-7 rounded-md" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5" style={{ width: `${width}%` }} />
                <Skeleton className="h-3" style={{ width: `${width * 0.6}%` }} />
              </span>
              <Skeleton className="h-3 w-12" />
            </span>
          ))}
        </div>
      </Loading>
    </div>
  );
}

/** The canvas: dot grid, the floating title, an agent with a channel above and pieces below, and the toolbar. */
export function CanvasSkeleton() {
  return (
    <Loading label="Loading canvas" className="skeleton-canvas">
      <Dots id="skeleton-canvas-dots" gap={20} />
      <span className="skeleton-panel skeleton-canvas-title">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-40" />
      </span>
      <span className="skeleton-canvas-graph" aria-hidden="true">
        <span className="skeleton-canvas-row">
          <Skeleton className="size-12 rounded-2xl" />
          <Skeleton className="size-12 rounded-2xl" />
        </span>
        <span className="skeleton-panel skeleton-canvas-agent">
          <Skeleton className="size-10 rounded-xl" />
          <span className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </span>
        </span>
        <span className="skeleton-canvas-row">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="size-12 rounded-full" />
        </span>
      </span>
      <span className="skeleton-panel skeleton-canvas-toolbar">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="size-7" />
        ))}
      </span>
    </Loading>
  );
}

const TREE = [
  [0, 48],
  [1, 64],
  [1, 88],
  [2, 72],
  [2, 96],
  [2, 60],
  [1, 80],
  [2, 104],
  [0, 56],
  [0, 84],
  [0, 70],
];

const CODE_LINES = [42, 58, 0, 34, 70, 64, 52, 0, 28, 76, 60, 44, 0, 38, 22];

/** The files workbench: explorer tree on the left, an editor with a tab and code lines on the right. */
export function FilesSkeleton() {
  return (
    <Loading label="Loading files" className="explorer-layout">
      <div className="explorer-pane skeleton-tree">
        <span className="skeleton-row h-10 justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="size-6" />
        </span>
        {TREE.map(([depth, width], index) => (
          <span key={index} className="skeleton-row h-7" style={{ paddingInlineStart: 12 + depth * 14 }}>
            <Skeleton className="size-3.5 rounded" />
            <Skeleton className="h-3" style={{ width }} />
          </span>
        ))}
      </div>
      <div className="skeleton-editor">
        <span className="skeleton-editor-tabs">
          <Skeleton className="h-3 w-32" />
        </span>
        <span className="skeleton-editor-code">
          {CODE_LINES.map((width, index) => (
            <span key={index} className="skeleton-row h-5 gap-4 px-0">
              <Skeleton className="h-2.5 w-4" />
              {width > 0 && <Skeleton className="h-2.5" style={{ width: `${width}%` }} />}
            </span>
          ))}
        </span>
      </div>
    </Loading>
  );
}
