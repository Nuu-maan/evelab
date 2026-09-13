import { createElement } from "react";

/** The shapes inside a 16x16 Geist icon, as `[tag, attributes]` pairs. */
export type IconData = readonly (readonly [string, Readonly<Record<string, string>>])[];

/**
 * Geist icons at the app's default size. Icon data is plain arrays, so an icon
 * can be chosen on the server and rendered by a client component.
 */
export function Icon({
  icon,
  size = 16,
  className,
}: {
  icon: IconData;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {icon.map(([tag, attributes], index) => createElement(tag, { key: index, ...attributes }))}
    </svg>
  );
}
