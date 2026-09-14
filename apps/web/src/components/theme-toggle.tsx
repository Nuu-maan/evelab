"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { THEME_KEY, type Theme } from "@/lib/theme";

/**
 * Switches between light and dark. The head script has already applied the
 * theme before paint; this reads it back, and until someone picks one it keeps
 * following the system as that changes.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>();

  useEffect(() => {
    const root = document.documentElement;
    setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_KEY)) return;
      const next: Theme = event.matches ? "dark" : "light";
      root.dataset.theme = next;
      setTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={`Switch to ${next} theme`}
          onClick={() => {
            document.documentElement.dataset.theme = next;
            localStorage.setItem(THEME_KEY, next);
            setTheme(next);
          }}
        >
          <Icon icon={theme === "dark" ? IconSun : IconMoon} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{theme === "dark" ? "Light theme" : "Dark theme"}</TooltipContent>
    </Tooltip>
  );
}
