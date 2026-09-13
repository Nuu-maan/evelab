"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { IconWarning } from "@/components/icons";
import type { SkillCandidate } from "@/lib/skill-types";
import { installSkillAction, previewSkillAction } from "@/lib/actions";
import { Icon } from "@/components/icon";
import { EASE_OUT } from "@/components/interaction";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Import is two steps on purpose: read the source, then install.
 *
 * The review step shows where the skill came from, every file that would be
 * written, and which of them can run code. Nothing is written until Install.
 */
export function SkillImportDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [candidate, setCandidate] = useState<SkillCandidate | undefined>();
  const [openFile, setOpenFile] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) return;
    setCandidate(undefined);
    setOpenFile(undefined);
    setError(undefined);
    setBusy(false);
  }, [open]);

  const preview = async () => {
    setBusy(true);
    setError(undefined);
    const result = await previewSkillAction(url);
    setBusy(false);
    if (result.ok) setCandidate(result.candidate);
    else setError(result.message);
  };

  const install = async () => {
    if (!candidate) return;
    setBusy(true);
    setError(undefined);
    try {
      await installSkillAction({
        projectId,
        id: candidate.id,
        name: candidate.name,
        description: candidate.description,
        source: candidate.source,
        files: candidate.files.map((file) => ({ path: file.path, content: file.content })),
      });
      router.refresh();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not install that skill.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[82vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="p-5 pb-4">
          <DialogTitle>Import skill</DialogTitle>
          <DialogDescription>Paste a GitHub link to a directory containing SKILL.md.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-5 pb-5">
          <Field>
            <FieldLabel htmlFor="skill-url">Source</FieldLabel>
            <Input
              className="font-mono"
              id="skill-url"
              value={url}
              placeholder="https://github.com/owner/repo/tree/main/skills/web-research"
              onChange={(event) => {
                setUrl(event.target.value);
                setCandidate(undefined);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && url && !busy) void preview();
              }}
              autoFocus
            />
            <FieldDescription>
              EveLab reads the directory and shows you what it found. It installs nothing yet.
            </FieldDescription>
            {error && <FieldError>{error}</FieldError>}
          </Field>

          {candidate && (
            <>
              <div className="grid-2">
                <div className="stat">
                  <span className="stat-label">Name</span>
                  <span className="stat-value">{candidate.name}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Installs as</span>
                  <span className="stat-value mono">skills/{candidate.id}/</span>
                </div>
              </div>

              {candidate.description && <p>{candidate.description}</p>}

              {candidate.warnings.map((warning) => (
                <Alert key={warning}>
                  <Icon icon={IconWarning} className="text-warning" />
                  <AlertTitle className="font-normal">{warning}</AlertTitle>
                </Alert>
              ))}

              <div className="section">
                <p className="label">{candidate.files.length} files</p>
                {candidate.files.map((file) => (
                  <div key={file.path}>
                    <button
                      className="file-chip"
                      data-flagged={file.executable}
                      type="button"
                      onClick={() => setOpenFile(openFile === file.path ? undefined : file.path)}
                    >
                      <span>{file.path}</span>
                      <span className="hint">
                        {file.executable ? "can run code · " : ""}
                        {openFile === file.path ? "hide" : "read"}
                      </span>
                    </button>
                    <AnimatePresence>
                      {openFile === file.path && (
                        <motion.pre
                          className="code"
                          style={{ marginTop: "var(--space-2)", maxHeight: 260 }}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={EASE_OUT}
                        >
                          {file.content.slice(0, 8000)}
                        </motion.pre>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="m-0 px-5 py-3">
          {!candidate ? (
            <Button type="button" disabled={!url || busy} onClick={() => void preview()}>
              {busy ? "Reading" : "Read source"}
            </Button>
          ) : (
            <>
              <Button variant="ghost" type="button" onClick={() => setCandidate(undefined)}>
                Back
              </Button>
              <Button type="button" disabled={busy} onClick={() => void install()}>
                {busy ? "Installing" : `Install ${candidate.files.length} files`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
