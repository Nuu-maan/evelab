/**
 * The EveLab mark: a diamond, the node you place on the canvas, with a dot at
 * its center, the agent inside it. Straight edges on the diamond keep every
 * corner sharp at any size.
 */
export const MARK_VIEWBOX = "0 0 20 20";
export const MARK_PATH =
  "M10 0L20 10L10 20L0 10Z M10 3.2L3.2 10L10 16.8L16.8 10Z M12.4 10A2.4 2.4 0 1 0 7.6 10A2.4 2.4 0 1 0 12.4 10Z";

export function Mark({ className = "topbar-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false" shapeRendering="geometricPrecision">
      <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
