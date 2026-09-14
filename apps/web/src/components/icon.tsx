import { createElement } from "react";

/**
 * An icon as plain data: its Lucide shapes on a 24px grid, whether it is a
 * filled brand mark, and the Rune Icons glass drawing that replaces the shapes
 * when Rune has one.
 */
export interface IconData {
  readonly nodes: readonly (readonly [string, Readonly<Record<string, string | number>>])[];
  readonly filled?: boolean;
  /** A file in public/icons/glass, without the extension. */
  readonly glass?: string;
}

/**
 * Glass icons from Rune Icons wherever Rune draws one; everything else falls
 * back to a Lucide outline on the same 24px grid, drawn at 16px with a round
 * 2px stroke. Glass drawings load as images so their gradient and mask ids
 * never collide on a page full of them.
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
  if (icon.glass) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/icons/glass/${icon.glass}.svg`}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        draggable={false}
        decoding="async"
        className={["icon icon-glass", className].filter(Boolean).join(" ")}
      />
    );
  }
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
