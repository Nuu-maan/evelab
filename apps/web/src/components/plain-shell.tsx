import Link from "next/link";
import { Mark } from "@/components/mark";
import { Avatar } from "@/components/project-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions";
import { getAccount } from "@/lib/session";

/**
 * Shell for pages outside a project. Applied per page rather than as a layout,
 * so project pages keep their own sidebar shell and nothing double-wraps.
 */
export async function PlainShell({ children }: { children: React.ReactNode }) {
  const account = await getAccount();

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
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/projects">Projects</Link>
          </Button>
          {account && (
            <>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Avatar name={account.name} image={account.image} />
                {account.name}
              </span>
              <form action={signOutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
