import { BRANDS, type BrandId } from "@/lib/brands";
import { cn } from "@/lib/utils";

/** A service's own logo. Decorative: the name always sits beside it. */
export function BrandLogo({ brand, size = 20, className }: { brand: BrandId; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("brand-logo inline-grid shrink-0 [&>svg]:size-full", className)}
      style={{ width: size, height: size }}
      // Static marks from this repository, never user input.
      dangerouslySetInnerHTML={{ __html: BRANDS[brand].svg }}
    />
  );
}
