"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmCopy {
  title: string;
  description: ReactNode;
  confirmLabel: string;
}

/** A controlled confirmation for flows that already know what they are about to do. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmCopy & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The submit button of a destructive form. It asks first, then submits the form
 * it sits in, so server actions stay plain forms that work without this.
 */
export function ConfirmSubmit({
  children,
  variant = "destructive",
  size,
  onConfirmed,
  ...copy
}: ConfirmCopy & {
  children: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  onConfirmed?: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button ref={button} type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <ConfirmDialog
        {...copy}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => {
          button.current?.form?.requestSubmit();
          onConfirmed?.();
        }}
      />
    </>
  );
}
