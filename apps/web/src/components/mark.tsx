/**
 * The evelab mark: a hub node wired to a second node and a module, the canvas
 * in its smallest form. The viewBox is cropped to the shapes so it fills its box.
 */
export const MARK_VIEWBOX = "5 5 22.5 22.5";

/** The mark's shapes in one color. The OG image renderer calls this as a function: it skips components inside svg. */
export function MarkShapes({ color = "currentColor" }: { color?: string }) {
  return (
    <g>
      <path d="M9 23L23 9M9 23H21" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="9" cy="23" r="4" fill={color} />
      <circle cx="23" cy="9" r="4" fill={color} />
      <rect x="19" y="19" width="8.5" height="8.5" rx="3" fill={color} />
    </g>
  );
}

export function Mark({ className = "topbar-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false" shapeRendering="geometricPrecision">
      <MarkShapes />
    </svg>
  );
}
