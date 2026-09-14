/**
 * The EveLab mark: a solid diamond, the node you place on the canvas. One shape,
 * like Vercel's triangle, so it stays sharp at any size.
 */
export const MARK_VIEWBOX = "0 0 20 20";
export const MARK_PATH = "M10 0L20 10L10 20L0 10Z";

export function Mark({ className = "topbar-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false" shapeRendering="geometricPrecision">
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}
