"use client";

import { useEffect, useState } from "react";

/**
 * A keyboard shortcut label. Renders the Mac glyph on the server and swaps to
 * Ctrl after mount on other platforms, where ⌘ means nothing.
 */
export function Shortcut({ keys }: { keys: string }) {
  const [mod, setMod] = useState("⌘");

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.userAgent)) setMod("Ctrl ");
  }, []);

  return <kbd className="kbd">{`${mod}${keys}`}</kbd>;
}
