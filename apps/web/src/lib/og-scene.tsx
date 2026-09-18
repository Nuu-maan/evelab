import { Fragment, isValidElement, type ReactNode } from "react";
import { HeroIllustration } from "@/components/landing/hero-scene";

/*
 * The landing hero, frozen on its drop frame for the share image. The image
 * renderer has no stylesheet and skips components inside SVG, so this walks the
 * drawing into a plain SVG string and swaps each class for the dark theme's
 * colours, written out as attributes.
 */

const INK = "#ededed";
const PAPER = "#0a0a0a";

/** color-mix(in srgb, ink pct%, paper), as hex. */
function mix(pct: number, base = PAPER) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round((channel(INK, i) * pct + channel(base, i) * (100 - pct)) / 100).toString(16).padStart(2, "0"))
    .join("")}`;
}

const LINE = mix(26);
const TOP = mix(3);
const SOFT = mix(16);
const round = { "stroke-linecap": "round", "stroke-linejoin": "round" };

/** The landing CSS for each class, resolved. Later classes on an element win, as in the cascade. */
const CLASSES: Record<string, Record<string, string | number> | null> = {
  "iso-top": { fill: TOP, stroke: LINE, "stroke-width": 1.2 },
  "iso-side": { fill: mix(10), stroke: LINE, "stroke-width": 1.2 },
  "iso-wall": { fill: mix(7) },
  "iso-edge": { stroke: LINE, "stroke-width": 1.2 },
  "iso-inner": { fill: "none", stroke: SOFT, "stroke-width": 1 },
  "iso-shadow": { fill: INK, "fill-opacity": 0.04 },
  "iso-dot": { fill: SOFT },
  "iso-ink": { fill: mix(82) },
  "iso-bar": { fill: SOFT },
  "iso-bar-soft": { fill: mix(10) },
  "iso-rule": { stroke: LINE, "stroke-width": 1 },
  "iso-glyph": { fill: "none", "stroke-width": 1.6, ...round },
  "iso-wire": { fill: "none", stroke: mix(38), "stroke-width": 1.4, "stroke-dasharray": "3 4", ...round },
  "iso-wire-new": { "stroke-dasharray": "none" },
  "iso-slot": { fill: "none", stroke: mix(35), "stroke-width": 1.2, "stroke-dasharray": "3 3" },
  "iso-tube-outer": { fill: "none", stroke: LINE, "stroke-width": 11, ...round },
  "iso-tube-inner": { fill: "none", stroke: TOP, "stroke-width": 8.6, ...round },
  "iso-prism-front": { fill: mix(86), stroke: mix(86), "stroke-width": 1, "stroke-linejoin": "round" },
  "iso-prism-side": { fill: mix(62), stroke: mix(62), "stroke-width": 1, "stroke-linejoin": "round" },
  "iso-ring": { fill: "none", stroke: mix(45), "stroke-width": 1.2, opacity: 0.6 },
  "iso-cursor": { fill: INK, stroke: PAPER, "stroke-width": 1.4, "stroke-linejoin": "round" },
  "iso-name": { fill: mix(45), "font-family": "Geist, sans-serif", "font-weight": 600 },
  // Moving parts with no still frame: the pulses, and the rings the first one stands in for.
  "iso-pulse": null,
  "iso-ring-1": null,
  "iso-ring-2": null,
};

/** The glyph colours the canvas gives each kind. */
const KIND_STROKE: Record<string, string> = { tool: "#52a8ff", skill: "#ffb224", connection: "#0ac7b4", channel: "#f75f8f" };

/*
 * On the site these strokes are non-scaling, so they stay hairline inside plane()'s
 * matrix. The image renderer ignores that, so their widths and dashes are divided
 * by the scale the transforms above them apply.
 */
const NON_SCALING = new Set(["iso-top", "iso-side", "iso-inner", "iso-slot", "iso-ring", "iso-shadow", "iso-wire", "iso-rule", "iso-glyph"]);

/** How much a transform attribute scales lengths: the square root of its area scale. */
function transformScale(transform: string) {
  let scale = 1;
  for (const [, name, args] of transform.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (name === "matrix") scale *= Math.sqrt(Math.abs(n[0] * n[3] - n[1] * n[2]));
    if (name === "scale") scale *= Math.sqrt(Math.abs(n[0] * (n[1] ?? n[0])));
  }
  return scale;
}

/** SVG attributes that keep their camelCase. */
const CAMEL = new Set(["viewBox", "pathLength"]);
const SKIP_TAGS = new Set(["animate", "animateMotion"]);
const SKIP_PROPS = new Set(["children", "key", "role", "aria-label", "className", "vectorEffect"]);

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function serialize(node: ReactNode, scale = 1): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return escape(String(node));
  if (Array.isArray(node)) return node.map((child) => serialize(child, scale)).join("");
  if (!isValidElement(node)) return "";

  const props = node.props as Record<string, unknown> & { children?: ReactNode; className?: string };
  if (node.type === Fragment) return serialize(props.children, scale);
  if (typeof node.type === "function") return serialize((node.type as (p: typeof props) => ReactNode)(props), scale);

  const tag = node.type as string;
  if (SKIP_TAGS.has(tag)) return "";

  const local = scale * (typeof props.transform === "string" ? transformScale(props.transform) : 1);
  const attributes: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(props)) {
    if (SKIP_PROPS.has(name) || value == null || typeof value === "object") continue;
    attributes[CAMEL.has(name) ? name : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)] = value as string | number;
  }
  for (const name of props.className?.split(" ") ?? []) {
    const style = CLASSES[name];
    if (style === null) return "";
    Object.assign(attributes, style);
    if (NON_SCALING.has(name) && style) {
      if (typeof style["stroke-width"] === "number") attributes["stroke-width"] = +(style["stroke-width"] / local).toFixed(4);
      if (typeof style["stroke-dasharray"] === "string" && style["stroke-dasharray"] !== "none") {
        attributes["stroke-dasharray"] = style["stroke-dasharray"].split(" ").map((d) => +(Number(d) / local).toFixed(4)).join(" ");
      }
    }
  }
  const kind = attributes["data-kind"];
  if (typeof kind === "string" && KIND_STROKE[kind]) attributes.stroke = KIND_STROKE[kind];

  const text = Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${escape(String(value))}"`)
    .join("");
  return `<${tag}${text}>${serialize(props.children, local)}</${tag}>`;
}

/** The hero drawing as a data URI, and its aspect ratio, for an <img> in the share image. */
export function heroSceneImage() {
  const svg = serialize(HeroIllustration()).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, ratio: 458 / 486 };
}
