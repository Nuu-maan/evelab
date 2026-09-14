/**
 * The EveLab mark: a solid diamond, the node you place on the canvas, with a
 * ring cut out to leave a dot at its center, the agent inside. The diamond's
 * edge, the ring and the dot share one weight, so the mark holds up at 16px.
 */
export const MARK_VIEWBOX = "0 0 20 20";
export const MARK_PATH =
  "M10 0L20 10L10 20L0 10Z M14.6 10A4.6 4.6 0 1 0 5.4 10A4.6 4.6 0 1 0 14.6 10Z M12.3 10A2.3 2.3 0 1 0 7.7 10A2.3 2.3 0 1 0 12.3 10Z";

export function Mark({ className = "topbar-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false" shapeRendering="geometricPrecision">
      <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
