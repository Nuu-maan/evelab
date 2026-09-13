import { createElement } from "react";

/** A Lucide icon as plain data: its shapes on a 24px grid, and whether it is a filled brand mark. */
export interface IconData {
  readonly nodes: readonly (readonly [string, Readonly<Record<string, string | number>>])[];
  readonly filled?: boolean;
}

/**
 * One icon style everywhere: a 24px grid drawn at 16px with a round 2px
 * stroke, so no icon reads heavier, sharper or larger than its neighbours.
 * Icon data is plain, so an icon can be chosen on the server and rendered by a
 * client component.
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
  const stroke = icon.filled
    ? { fill: "currentColor" }
    : { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...stroke}
      className={["icon", className].filter(Boolean).join(" ")}
      aria-hidden="true"
      focusable="false"
    >
      {icon.nodes.map(([tag, attributes], index) => createElement(tag, { key: index, ...attributes }))}
    </svg>
  );
}
