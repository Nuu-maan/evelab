import { createElement } from "react";

/**
 * An icon as plain data: its shapes on a 24px grid, whether it is a filled
 * brand mark, and whether it is a Rune duotone drawing that carries its own
 * strokes and fills.
 */
export interface IconData {
  readonly nodes: readonly (readonly [string, Readonly<Record<string, string | number>>])[];
  readonly filled?: boolean;
  /** Rune Icons duotone: each shape sets its own stroke and fill, the lighter tone at reduced opacity. */
  readonly duotone?: boolean;
}

/**
 * Rune duotone icons wherever Rune draws one, and a Lucide outline otherwise,
 * both on a 24px grid at 16px with a round 2px stroke. Both tones follow
 * currentColor, so an icon takes the colour of the text or kind around it.
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
  const stroke = icon.duotone
    ? { fill: "none" }
    : icon.filled
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
