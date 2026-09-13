"use client";

import { useCallback, useEffect, useState } from "react";
import { IconSidebarLeft } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Shortcut } from "@/components/shortcut";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIDEBAR_COOKIE, type SidebarState } from "@/lib/sidebar-state";

/**
 * Shows and hides the project sidebar.
 *
 * The state lives in `data-sidebar` on the shell, so CSS runs the animation
 * without re-rendering the sidebar, and in a cookie, so the server renders the
 * same layout next time.
 */
export function SidebarToggle({ initial }: { initial: SidebarState }) {
  const [open, setOpen] = useState(initial === "open");

  const toggle = useCallback(() => {
    const shell = document.querySelector<HTMLElement>("[data-sidebar]");
    if (!shell) return;
    const next: SidebarState = shell.dataset.sidebar === "closed" ? "open" : "closed";
    shell.dataset.sidebar = next;
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setOpen(next === "open");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

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
