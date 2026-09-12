"use client";

import Editor, { DiffEditor, type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useState } from "react";

export function languageFor(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".sh")) return "shell";
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

/** Themes that sit on the app's own surfaces instead of Visual Studio's grays. */
const prepare: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("evelab-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0a0a0a",
      "editorGutter.background": "#0a0a0a",
      "editorLineNumber.foreground": "#4a4a4a",
      "editorLineNumber.activeForeground": "#a1a1a1",
      "editor.lineHighlightBackground": "#141414",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#1f1f1f",
      "editorIndentGuide.activeBackground1": "#383838",
      "editorWidget.background": "#111111",
      "editorWidget.border": "#242424",
      "editorSuggestWidget.background": "#111111",
      "editorSuggestWidget.border": "#242424",
      "scrollbarSlider.background": "#ffffff14",
      "scrollbarSlider.hoverBackground": "#ffffff24",
      "scrollbarSlider.activeBackground": "#ffffff30",
      focusBorder: "#00000000",
    },
  });
  monaco.editor.defineTheme("evelab-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editorGutter.background": "#ffffff",
      "editorLineNumber.foreground": "#b3b3b3",
      "editorLineNumber.activeForeground": "#666666",
      "editor.lineHighlightBackground": "#fafafa",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#ebebeb",
      "editorIndentGuide.activeBackground1": "#d4d4d4",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#ebebeb",
      "scrollbarSlider.background": "#0000001a",
      "scrollbarSlider.hoverBackground": "#0000002a",
      "scrollbarSlider.activeBackground": "#00000036",
      focusBorder: "#00000000",
    },
  });

  // Project sources import packages that do not exist in the browser, so type
  // checking here only paints every import red. Syntax errors still show.
  const diagnostics = { noSemanticValidation: true, noSyntaxValidation: false };
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnostics);
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnostics);
};

/** Read-only side-by-side diff: the last synced version on the left, the file on disk on the right. */
export function CodeDiffEditor({
  original,
  modified,
  language,
}: {
  original: string;
  modified: string;
  language: string;
}) {
  const dark = usePrefersDark();

  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme={dark ? "evelab-dark" : "evelab-light"}
      beforeMount={prepare}
      loading={<span className="palette-hint">Loading diff</span>}
      options={{
        readOnly: true,
        originalEditable: false,
        renderSideBySide: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 20,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderOverviewRuler: false,
        padding: { top: 12, bottom: 12 },
      }}
      height="100%"
    />
  );
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
      theme={dark ? "evelab-dark" : "evelab-light"}
      beforeMount={prepare}
      onMount={onMount}
      onChange={(next) => onChange?.(next ?? "")}
      loading={<span className="palette-hint">Loading editor</span>}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 20,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        lineNumbers: "on",
        renderLineHighlight: "line",
        scrollBeyondLastLine: false,
        wordWrap: language === "markdown" ? "on" : "off",
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        guides: { indentation: true },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
      }}
      height="100%"
    />
  );
}
