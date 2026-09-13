"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileIcon } from "@/components/files/file-icon";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * ⌘P: jump to any file in the project by name. Like the command palette it
 * opens without animation, because it is summoned from the keyboard.
 */
export function QuickOpen({ projectId, paths }: { projectId: string; paths: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "p" && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Open file"
      description="Search the project's files"
      className="top-[14vh] sm:max-w-xl data-open:animate-none! data-closed:animate-none!"
    >
      <Command>
        <CommandInput placeholder="Search files" aria-label="Search files" />
        <CommandList className="max-h-[min(420px,60vh)]">
          <CommandEmpty>No matching file</CommandEmpty>
          {paths.map((path) => {
            const name = path.slice(path.lastIndexOf("/") + 1);
            const directory = path.slice(0, Math.max(0, path.lastIndexOf("/")));
            return (
              <CommandItem
                key={path}
                value={path}
                className="h-9"
                onSelect={() => {
                  setOpen(false);
                  router.push(`/projects/${projectId}/files?path=${encodeURIComponent(path)}`);
                }}
              >
                <FileIcon name={name} />
                <span className="truncate">{name}</span>
                {directory && <span className="ml-auto truncate text-xs text-muted-foreground">{directory}</span>}
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
