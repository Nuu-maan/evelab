import "server-only";

/**
 * Tells the runtime when project files change, without the workspace module
 * having to know about runtimes. A running Vercel Sandbox subscribes so that a
 * save in EveLab reaches `eve dev` in the VM the same way it would on disk.
 */

export interface FileChange {
  path: string;
  /** Undefined when the file was deleted. */
  content?: string;
}

type Listener = (projectId: string, changes: FileChange[]) => void;

const listeners: Set<Listener> = ((globalThis as { __evelabProjectListeners?: Set<Listener> }).__evelabProjectListeners ??=
  new Set());

export function onProjectFilesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitProjectFilesChanged(projectId: string, changes: FileChange[]): void {
  if (changes.length === 0) return;
  for (const listener of listeners) {
    try {
      listener(projectId, changes);
    } catch {
      // A listener's failure never blocks a save.
    }
  }
}
