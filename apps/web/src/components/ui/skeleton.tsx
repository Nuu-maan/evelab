import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A placeholder block that holds the shape of content while it loads. */
function Skeleton({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="skeleton" aria-hidden="true" className={cn("skeleton", className)} {...props} />;
}

export { Skeleton };
