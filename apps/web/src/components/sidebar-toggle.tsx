"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IconSidebarLeft } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Shortcut } from "@/components/shortcut";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIDEBAR_COOKIE, type SidebarState } from "@/lib/sidebar-state";

/** Matches the width in shell.css below which the sidebar is a drawer over the page. */
const DRAWER_QUERY = "(max-width: 960px)";

function shellElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-sidebar]");
}

/**
 * Shows and hides the project sidebar.
 *
 * On a wide screen the state lives in `data-sidebar` on the shell, so CSS runs
 * the animation without re-rendering the sidebar, and in a cookie, so the
 * server renders the same layout next time. On a narrow screen the sidebar is a
 * drawer: `data-drawer` opens it over the page, and it closes on navigation,
 * Escape, or a press outside it, without touching the saved preference.
 */
export function SidebarToggle({ initial }: { initial: SidebarState }) {
  const [open, setOpen] = useState(initial === "open");
  const pathname = usePathname();

  const closeDrawer = useCallback(() => {
    const shell = shellElement();
    if (shell?.dataset.drawer !== "open") return;
    shell.dataset.drawer = "closed";
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    const shell = shellElement();
    if (!shell) return;
    if (window.matchMedia(DRAWER_QUERY).matches) {
      const next = shell.dataset.drawer === "open" ? "closed" : "open";
      shell.dataset.drawer = next;
      setOpen(next === "open");
      return;
    }
    const next: SidebarState = shell.dataset.sidebar === "closed" ? "open" : "closed";
    shell.dataset.sidebar = next;
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setOpen(next === "open");
  }, []);

  // A drawer starts closed, whatever the desktop preference says.
  useEffect(() => {
    if (window.matchMedia(DRAWER_QUERY).matches) setOpen(false);
  }, []);

  useEffect(() => closeDrawer(), [closeDrawer, pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        toggle();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".sidebar") || target?.closest(".sidebar-toggle")) return;
      closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [closeDrawer, toggle]);

  const label = open ? "Hide sidebar" : "Show sidebar";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="sidebar-toggle size-8 text-muted-foreground hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:bg-muted aria-expanded:hover:text-foreground"
          type="button"
          aria-label={label}
          aria-expanded={open}
          data-open={open || undefined}
          onClick={toggle}
        >
          <Icon icon={IconSidebarLeft} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        <Shortcut keys="B" />
      </TooltipContent>
    </Tooltip>
  );
}
