"use client";

import { useId, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Icon, type IconData } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BrandId } from "@/lib/brands";

/** The logo tile eve.dev puts on each integration: the brand, or the kind's icon for generic entries. */
export function IntegrationMark({ brand, icon }: { brand?: BrandId; icon: IconData }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-background text-foreground">
      {brand ? <BrandLogo brand={brand} size={20} /> : <Icon icon={icon} size={18} />}
    </span>
  );
}

export function IntegrationCard({
  name,
  description,
  tag,
  brand,
  icon,
  added,
  onSelect,
}: {
  name: string;
  description: string;
  tag: string;
  brand?: BrandId;
  icon: IconData;
  added?: boolean;
  onSelect: () => void;
}) {
  const descriptionId = useId();
  return (
    <button
      type="button"
      aria-label={name}
      aria-describedby={descriptionId}
      disabled={added}
      onClick={onSelect}
      className="flex h-full w-full flex-col gap-4 rounded-lg border bg-card p-5 text-left outline-none transition-colors hover:border-[var(--border-strong)] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:border-border disabled:hover:bg-card"
    >
      <span className="flex w-full items-start justify-between gap-3">
        <IntegrationMark brand={brand} icon={icon} />
        <span className="flex flex-wrap justify-end gap-1.5">
          {added && <Badge variant="secondary">Added</Badge>}
          <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">{tag}</span>
        </span>
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[15px] font-medium tracking-tight">{name}</span>
        <span id={descriptionId} className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {description}
        </span>
      </span>
    </button>
  );
}

export function IntegrationDialog({
  open,
  onClose,
  name,
  description,
  brand,
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  description: string;
  brand?: BrandId;
  icon: IconData;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <IntegrationMark brand={brand} icon={icon} />
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
