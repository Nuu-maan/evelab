"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useState } from "react";

export function languageFor(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  return "plaintext";
}

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return dark;
}

export function CodeEditor({
  value,
  language,
  readOnly,
  onChange,
  onSave,
}: {
  value: string;
  language: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}) {
  const dark = usePrefersDark();

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave?.());
  };

  return (
    <Editor
      value={value}
      language={language}
      theme={dark ? "vs-dark" : "vs"}
      onMount={onMount}
      onChange={(next) => onChange?.(next ?? "")}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        lineNumbers: "on",
        renderLineHighlight: "none",
        scrollBeyondLastLine: false,
        wordWrap: language === "markdown" ? "on" : "off",
        automaticLayout: true,
        padding: { top: 12 },
      }}
      height="100%"
    />
  );
}
