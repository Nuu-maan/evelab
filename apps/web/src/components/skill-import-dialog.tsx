"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { SkillCandidate } from "@/lib/skill-types";
import { installSkillAction, previewSkillAction } from "@/lib/actions";
import { X } from "lucide-react";
import { EASE_OUT, EXIT } from "@/components/interaction";

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay overlay-centered"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: EASE_OUT }}
          exit={{ opacity: 0, transition: EXIT }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Import skill"
            // A modal is not anchored to a trigger, so it scales from its own centre.
            initial={{ opacity: 0, transform: "scale(0.96)" }}
            animate={{ opacity: 1, transform: "scale(1)", transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] } }}
            exit={{ opacity: 0, transform: "scale(0.96)", transition: EXIT }}
          >
            <div className="modal-head">
              <div>
                <h2 className="section-title">Import skill</h2>
                <p className="list-item-detail">
                  Paste a GitHub link to a directory containing SKILL.md.
                </p>
              </div>
              <button
                className="button"
                data-variant="ghost"
                data-size="icon"
                type="button"
                aria-label="Close"
                onClick={onClose}
              >
                <X aria-hidden="true" strokeWidth={1.5} />
              </button>
            </div>

            <div className="modal-body">
              <div className="field">
                <label className="label" htmlFor="skill-url">
                  Source
                </label>
                <input
                  className="input mono"
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
                <p className="helper">
                  EveLab reads the directory and shows you what it found. It installs nothing yet.
                </p>
              </div>

              {error && <p className="error-text">{error}</p>}

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

                  {candidate.warnings.length > 0 && (
                    <ul className="list">
                      {candidate.warnings.map((warning) => (
                        <li className="notice" key={warning}>
                          {warning}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="section">
                    <p className="label">{candidate.files.length} files</p>
                    {candidate.files.map((file) => (
                      <div key={file.path}>
                        <button
                          className="file-chip"
                          data-flagged={file.executable}
                          type="button"
                          onClick={() =>
                            setOpenFile(openFile === file.path ? undefined : file.path)
                          }
                        >
                          <span>{file.path}</span>
                          <span className="palette-hint">
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

            <div className="modal-foot">
              {!candidate ? (
                <button
                  className="button"
                  data-variant="primary"
                  type="button"
                  disabled={!url || busy}
                  onClick={() => void preview()}
                >
                  {busy ? "Reading" : "Read source"}
                </button>
              ) : (
                <>
                  <button
                    className="button"
                    data-variant="ghost"
                    type="button"
                    onClick={() => setCandidate(undefined)}
                  >
                    Back
                  </button>
                  <button
                    className="button"
                    data-variant="primary"
                    type="button"
                    disabled={busy}
                    onClick={() => void install()}
                  >
                    {busy ? "Installing" : `Install ${candidate.files.length} files`}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
