/** The EveLab mark: two nested diamonds, the visual shorthand for GUI over code. */
export function Mark() {
  return (
    <svg
      className="topbar-mark"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.4" y="1.4" width="13.2" height="13.2" rx="2" transform="rotate(45 8 8)" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5.6" y="5.6" width="4.8" height="4.8" fill="currentColor" transform="rotate(45 8 8)" />
    </svg>
  );
}
