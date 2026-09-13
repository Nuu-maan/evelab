import Link from "next/link";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";

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
          <Button asChild variant="ghost" size="sm">
            <Link href="/projects">Projects</Link>
          </Button>
        </div>
      </header>
      {children}
    </div>
  );
}
