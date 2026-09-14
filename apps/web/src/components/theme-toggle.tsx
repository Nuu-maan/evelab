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
      apply(next);
      setTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";

  const apply = (value: Theme) => {
    // Pause every transition for one frame, so the new theme lands at once instead of each hover fade rippling in.
    const pause = document.createElement("style");
    pause.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(pause);
    document.documentElement.dataset.theme = value;
    void window.getComputedStyle(document.body).opacity;
    requestAnimationFrame(() => pause.remove());
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={`Switch to ${next} theme`}
          onClick={() => {
            apply(next);
            localStorage.setItem(THEME_KEY, next);
            setTheme(next);
          }}
        >
          {/* Keyed, so the new glyph mounts and eases in over the old one. */}
          <Icon key={theme ?? "unset"} icon={theme === "dark" ? IconSun : IconMoon} className="theme-toggle-icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{theme === "dark" ? "Light theme" : "Dark theme"}</TooltipContent>
    </Tooltip>
  );
}
