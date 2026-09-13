"use client";

import { useState } from "react";
import { SkillImportDialog } from "@/components/skill-import-dialog";
import { Button } from "@/components/ui/button";

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
      <Button variant={variant === "primary" ? "default" : "ghost"} type="button" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <SkillImportDialog projectId={projectId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
