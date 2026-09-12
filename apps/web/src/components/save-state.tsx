"use client";

export type SaveState = "saved" | "dirty" | "saving" | "error";

const LABELS: Record<SaveState, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving",
  error: "Save failed",
};

const TONES: Record<SaveState, string> = {
  saved: "ready",
  dirty: "modified",
  saving: "modified",
  error: "error",
};

export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span className="status" data-tone={TONES[state]} role="status">
      {LABELS[state]}
    </span>
  );
}
