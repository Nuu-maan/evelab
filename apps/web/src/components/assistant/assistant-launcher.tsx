"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

export const OPEN_ASSISTANT_EVENT = "evelab:assistant";

export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_EVENT, { detail: prompt }));
}

// The chat panel brings the AI SDK and Motion with it, so it loads the first time someone opens it, not with every page.
const AssistantPanel = dynamic(() => import("@/components/assistant/assistant-panel").then((mod) => mod.AssistantPanel), {
  ssr: false,
});

/**
 * Listens for the assistant shortcut and the open event on every project page,
 * and only fetches the panel itself once it is first asked for.
 */
export function AssistantLauncher({ projectId, available, model }: { projectId: string; available: boolean; model: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prompt, setPrompt] = useState<string>();

  useEffect(() => {
    const show = (value: boolean) => {
      if (value) setLoaded(true);
      setOpen(value);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "i" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setLoaded(true);
        setOpen((value) => !value);
      }
      if (event.key === "Escape") show(false);
    };
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<string | undefined>).detail;
      if (detail) setPrompt(detail);
      show(true);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    };
  }, []);

  if (!loaded) return null;
  return (
    <AssistantPanel
      projectId={projectId}
      available={available}
      model={model}
      open={open}
      prompt={prompt}
      onClose={() => setOpen(false)}
    />
  );
}
