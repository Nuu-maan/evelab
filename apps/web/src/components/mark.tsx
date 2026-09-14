/**
 * The EveLab mark: a diamond ring around a solid diamond core, the visual
 * shorthand for GUI over code.
 *
 * Drawn as one filled path on whole and half pixels rather than stroked,
 * rotated, rounded rectangles, so every corner is a true sharp point at any
 * size. The even-odd rule cuts the ring's hole and leaves the core filled.
 */
export const MARK_PATH = "M12 1 23 12 12 23 1 12Z M12 4.5 19.5 12 12 19.5 4.5 12Z M12 8 16 12 12 16 8 12Z";

export function Mark({ className = "topbar-mark" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
