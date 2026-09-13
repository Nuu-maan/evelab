"use client";

import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/kbd";

/**
 * A keyboard shortcut label. Renders the Mac glyph on the server and swaps to
 * Ctrl after mount on other platforms, where ⌘ means nothing.
 */
export function Shortcut({ keys, className }: { keys: string; className?: string }) {
  const [mod, setMod] = useState("⌘");

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.userAgent)) setMod("Ctrl ");
  }, []);

  return <Kbd className={className}>{`${mod}${keys}`}</Kbd>;
}
