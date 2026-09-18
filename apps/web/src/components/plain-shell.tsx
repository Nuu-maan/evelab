import Link from "next/link";
import { Mark } from "@/components/mark";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
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
          evelab
        </Link>
        <div className="topbar-actions">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className={account ? "max-[560px]:hidden" : undefined}>
            <Link href="/projects">Projects</Link>
          </Button>
          {account && <AccountMenu name={account.name} image={account.image} />}
        </div>
      </header>
      {children}
    </div>
  );
}
