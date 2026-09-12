"use client";

import { useState } from "react";
import { SkillImportDialog } from "@/components/skill-import-dialog";

export function SkillImportButton({
  projectId,
  variant = "primary",
  label = "Import skill",
}: {
  projectId: string;
  variant?: "primary" | "ghost";
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="button"
        data-variant={variant}
        type="button"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <SkillImportDialog projectId={projectId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
