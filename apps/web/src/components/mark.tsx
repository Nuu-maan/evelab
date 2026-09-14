/**
 * The EveLab mark: a solid square, the node you place on the canvas. One shape,
 * like Vercel's triangle, so it stays crisp at any size.
 */
export const MARK_VIEWBOX = "0 0 20 20";
export const MARK_PATH = "M0 0H20V20H0Z";

export function Mark({ className = "topbar-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}
