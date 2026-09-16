import { createElement, type ReactNode } from "react";
import type { CanvasNodeKind } from "@evelab/eve-project";
import { KINDS } from "@/components/kinds";

/*
 * The hero illustration: evelab drawn as an isometric line model. A canvas
 * platform holds the agent, four pillars hold what it uses, and hatched bridges
 * join them. Every line is the page's own text colour, so it reads the same in
 * light and dark; only the icons carry their kind colours. Geometry is computed
 * from boxes in 3D, so every face lines up exactly.
 */

const U = 22;
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

type Point = [number, number];

/** Isometric projection: +x runs down to the right, +y down to the left, +z straight up. */
function project(x: number, y: number, z: number): Point {
  return [(x - y) * COS * U, (x + y) * SIN * U - z * U];
}

function polygon(points: Point[]): string {
  return points.map(([px, py]) => `${px.toFixed(2)},${py.toFixed(2)}`).join(" ");
}

/** A matrix that lays flat 2D drawing onto a horizontal plane, one local unit being `scale` model units. */
function onPlane(x: number, y: number, z: number, scale: number): string {
  const [px, py] = project(x, y, z);
  const a = COS * U * scale;
  const b = SIN * U * scale;
  return `matrix(${a.toFixed(4)} ${b.toFixed(4)} ${(-a).toFixed(4)} ${b.toFixed(4)} ${px.toFixed(2)} ${py.toFixed(2)})`;
}

/** Like onPlane, but for an upright face facing the viewer's left: local x runs along the face, local y runs down. */
function onSide(x: number, y: number, z: number, scale: number): string {
  const [px, py] = project(x, y, z);
  return `matrix(${(COS * U * scale).toFixed(4)} ${(SIN * U * scale).toFixed(4)} 0 ${(U * scale).toFixed(4)} ${px.toFixed(2)} ${py.toFixed(2)})`;
}

/** For the upright face on the viewer's right (the plane x = constant), reading left to right. */
function onRightSide(x: number, y: number, z: number, scale: number): string {
  const [px, py] = project(x, y, z);
  return `matrix(${(COS * U * scale).toFixed(4)} ${(-SIN * U * scale).toFixed(4)} 0 ${(U * scale).toFixed(4)} ${px.toFixed(2)} ${py.toFixed(2)})`;
}

interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/** The three faces a viewer sees, back to front, with optional vertical lines down the sides. */
function Solid({ x, y, z, w, d, h, ribs = 0, className }: Box & { ribs?: number; className?: string }) {
  const top = [project(x, y, z + h), project(x + w, y, z + h), project(x + w, y + d, z + h), project(x, y + d, z + h)];
  const left = [project(x, y + d, z), project(x + w, y + d, z), project(x + w, y + d, z + h), project(x, y + d, z + h)];
  const right = [project(x + w, y, z), project(x + w, y + d, z), project(x + w, y + d, z + h), project(x + w, y, z + h)];
  const lines: ReactNode[] = [];
  for (let index = 1; index <= ribs; index++) {
    const t = index / (ribs + 1);
    const [lx1, ly1] = project(x + w * t, y + d, z);
    const [lx2, ly2] = project(x + w * t, y + d, z + h);
    const [rx1, ry1] = project(x + w, y + d * t, z);
    const [rx2, ry2] = project(x + w, y + d * t, z + h);
    lines.push(<line key={`l${index}`} x1={lx1} y1={ly1} x2={lx2} y2={ly2} className="iso-rib" />);
    lines.push(<line key={`r${index}`} x1={rx1} y1={ry1} x2={rx2} y2={ry2} className="iso-rib" />);
  }
  return (
    <g className={className}>
      <polygon points={polygon(left)} className="iso-face iso-side" />
      <polygon points={polygon(right)} className="iso-face iso-side" />
      {lines}
      <polygon points={polygon(top)} className="iso-face" />
    </g>
  );
}

/** A level walkway with cross hatching, running along x or along y, with a flowing centre line. */
function Bridge({ axis, from, to, centre, width = 1.2, z }: { axis: "x" | "y"; from: number; to: number; centre: number; width?: number; z: number }) {
  const at = (along: number, across: number, level: number) => (axis === "x" ? project(along, across, level) : project(across, along, level));
  const low = centre - width / 2;
  const high = centre + width / 2;
  const top = [at(from, low, z), at(to, low, z), at(to, high, z), at(from, high, z)];
  const side = axis === "x" ? [at(from, high, z), at(to, high, z), at(to, high, z - 0.25), at(from, high, z - 0.25)] : [at(from, high, z), at(to, high, z), at(to, high, z - 0.25), at(from, high, z - 0.25)];
  const hatch: ReactNode[] = [];
  const steps = Math.round(Math.abs(to - from) / 0.22);
  for (let index = 1; index < steps; index++) {
    const along = from + ((to - from) * index) / steps;
    const [x1, y1] = at(along, low + 0.08, z);
    const [x2, y2] = at(along, high - 0.08, z);
    hatch.push(<line key={index} x1={x1} y1={y1} x2={x2} y2={y2} className="iso-hatch" />);
  }
  const [cx1, cy1] = at(to, centre, z + 0.02);
  const [cx2, cy2] = at(from, centre, z + 0.02);
  return (
    <g>
      <polygon points={polygon(side)} className="iso-face iso-side" />
      <polygon points={polygon(top)} className="iso-face" />
      {hatch}
      <line x1={cx1} y1={cy1} x2={cx2} y2={cy2} className="iso-flow" />
    </g>
  );
}

function Glyph({ kind, x, y, z, size }: { kind: CanvasNodeKind; x: number; y: number; z: number; size: number }) {
  return (
    <g transform={onPlane(x, y, z, size / 24)} className="iso-glyph" data-kind={kind}>
      {KINDS[kind].icon.nodes.map(([tag, attributes], index) =>
        createElement(tag, { key: index, ...attributes, vectorEffect: "non-scaling-stroke" }),
      )}
    </g>
  );
}

/** A pillar below the platform's level, holding one kind of piece and its name. */
function Pillar({ x, y, kind, label, face = "left" }: { x: number; y: number; kind: CanvasNodeKind; label: string; face?: "left" | "right" }) {
  return (
    <g>
      <Solid x={x} y={y} z={-4.2} w={2.4} d={2.4} h={4.7} ribs={3} />
      <Solid x={x + 0.35} y={y + 0.35} z={0.5} w={1.7} d={1.7} h={0.18} />
      <Glyph kind={kind} x={x + 0.55} y={y + 0.55} z={0.68} size={1.3} />
      {/* The name goes on whichever upright face its bridge leaves clear. */}
      <text transform={face === "left" ? onSide(x + 0.3, y + 2.4, -0.45, 0.034) : onRightSide(x + 2.4, y + 2.1, -0.45, 0.034)} className="iso-label" fontSize={10}>
        {label}
      </text>
    </g>
  );
}

const PILLARS: { x: number; y: number; kind: CanvasNodeKind; label: string; face?: "left" | "right" }[] = [
  { x: 3.8, y: -5.6, kind: "channel", label: "CHANNELS", face: "right" },
  { x: -5.6, y: 3.8, kind: "tool", label: "TOOLS" },
  { x: 13.2, y: 3.8, kind: "skill", label: "SKILLS" },
  { x: 3.8, y: 13.2, kind: "connection", label: "MCP" },
];

export function HeroScene() {
  const dots: ReactNode[] = [];
  for (let gx = 0.5; gx < 10; gx += 1) {
    for (let gy = 0.5; gy < 10; gy += 1) {
      if (gx > 2.6 && gx < 7.4 && gy > 2.6 && gy < 7.4) continue;
      if (gy > 7.4 && gx < 7.4) continue;
      const [px, py] = project(gx, gy, 0.5);
      dots.push(<circle key={`${gx}-${gy}`} cx={px} cy={py} r={1.1} className="iso-dot" />);
    }
  }

  const code = ["defineAgent({", "  model: \"claude-opus-5\",", "});"];

  // Everything the scene draws, back to front, so nearer faces cover farther lines.
  const boxes: Box[] = [
    { x: 0, y: 0, z: 0, w: 10, d: 10, h: 0.5 },
    { x: 4.3, y: 4.3, z: 2.9, w: 1.4, d: 1.4, h: 0.9 },
    ...PILLARS.map(({ x, y }) => ({ x, y, z: -4.2, w: 2.4, d: 2.4, h: 4.9 })),
  ];
  const corners = boxes.flatMap(({ x, y, z, w, d, h }) =>
    [x, x + w].flatMap((cx) => [y, y + d].flatMap((cy) => [z, z + h].map((cz) => project(cx, cy, cz)))),
  );
  const xs = corners.map(([px]) => px);
  const ys = corners.map(([, py]) => py);
  const pad = 8;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - minX + pad;
  const height = Math.max(...ys) - minY + pad;

  return (
    <svg
      className="iso"
      viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`}
      role="img"
      aria-label="An agent on the evelab canvas, joined by bridges to its tools, skills, channels and MCP connections"
    >
      {/* Behind the platform: the channel and tool pillars and their bridges. */}
      <Pillar {...PILLARS[0]} />
      <Pillar {...PILLARS[1]} />
      <Bridge axis="y" from={-3.2} to={0} centre={5} z={0.5} />
      <Bridge axis="x" from={-3.2} to={0} centre={5} z={0.5} />

      {/* The canvas platform, its dot grid and the code it writes. */}
      <Solid x={0} y={0} z={0} w={10} d={10} h={0.5} />
      {dots}
      <g transform={onPlane(0.9, 8.3, 0.5, 0.034)} className="iso-code">
        {code.map((line, index) => (
          <text key={index} x={0} y={index * 14} fontSize={10}>
            {line}
          </text>
        ))}
      </g>

      {/* The agent: a tower with the evelab mark raised on top. */}
      <Solid x={3} y={3} z={0.5} w={4} d={4} h={2.2} ribs={4} />
      <Solid x={3.5} y={3.5} z={2.7} w={3} d={3} h={0.2} />
      <Solid x={4.3} y={4.3} z={2.9} w={1.4} d={1.4} h={0.9} className="iso-mark" />
      <text transform={onSide(3.4, 7, 1.15, 0.036)} className="iso-label" fontSize={10}>
        AGENT
      </text>

      {/* In front of the platform: the skill and connection pillars and their bridges. */}
      <Bridge axis="x" from={10} to={13.2} centre={5} z={0.5} />
      <Bridge axis="y" from={10} to={13.2} centre={5} z={0.5} />
      <Pillar {...PILLARS[2]} />
      <Pillar {...PILLARS[3]} />
    </svg>
  );
}
