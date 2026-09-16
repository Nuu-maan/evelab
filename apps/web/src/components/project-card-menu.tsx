"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { IconFileText, IconMoreVertical, IconRoute, IconSettingsGear, IconTrash } from "@/components/icons";
import { ConfirmDialog } from "@/components/confirm";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteProjectAction } from "@/lib/actions";

/**
 * A project card's actions behind one quiet button that is always visible, so
 * touch screens get the same controls as a mouse. Delete asks first, then
 * submits a plain form to the server action.
 */
export function ProjectCardMenu({ id, name, fileCount }: { id: string; name: string; fileCount: number }) {
  const form = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState(false);
  const base = `/projects/${id}`;
  const files = `${fileCount} ${fileCount === 1 ? "file" : "files"}`;

  return (
    <>
      {/* Not modal, so the confirmation can take focus the moment the menu closes. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="project-card-menu" aria-label={`Actions for ${name}`}>
            <Icon icon={IconMoreVertical} size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`${base}/canvas`}>
              <Icon icon={IconRoute} />
              Open canvas
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`${base}/files`}>
              <Icon icon={IconFileText} />
              Browse files
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`${base}/settings`}>
              <Icon icon={IconSettingsGear} />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Icon icon={IconTrash} />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form ref={form} action={deleteProjectAction} hidden>
        <input type="hidden" name="id" value={id} />
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${name}?`}
        description={`This deletes ${name} and its ${files}. It cannot be undone.`}
        confirmLabel="Delete project"
        onConfirm={() => form.current?.requestSubmit()}
      />
    </>
  );
}
