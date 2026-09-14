/**
 * The EveLab mark, written in eve's own geometry: the E's three square-cut bars
 * and the slash from eve's wordmark, with the second E replaced by a solid
 * block, the node you place on the canvas. Straight edges only, so every corner
 * stays sharp at any size.
 */
export const MARK_VIEWBOX = "0 0 28 20";
export const MARK_PATH =
  "M0 0H10V3.2H0Z M0 8.4H5.5V11.6H0Z M0 16.8H6.8V20H0Z M9.2 20H12.8L22.8 0H19.2Z M21 12.8H28V20H21Z";

export function Mark({ className = "topbar-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false" shapeRendering="geometricPrecision">
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}
