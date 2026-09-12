import Link from "next/link";
import { Mark } from "@/components/mark";

/**
 * Shell for pages outside a project. Applied per page rather than as a layout,
 * so project pages keep their own sidebar shell and nothing double-wraps.
 */
export function PlainShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="plain-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="topbar-brand" href="/projects">
          <Mark />
          EveLab
        </Link>
        <div className="topbar-actions">
          <Link className="button" data-variant="ghost" href="/projects">
            Projects
          </Link>
          <Link className="button" data-variant="primary" href="/projects/new">
            New project
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
