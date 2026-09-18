import { createElement, type ReactNode } from "react";
import type { CanvasNodeKind } from "@evelab/eve-project";
import { KINDS } from "@/components/kinds";

/*
 * The hero illustration: evelab, then eve, then Vercel, as three rounded
 * isometric islands joined by tubes.
 *
 * On the evelab island someone is building on the canvas: a cursor drags a
 * connection onto the board, it drops into its slot and its wire draws in to
 * the agent. A pulse runs down the tube to the eve island, where the agent's
 * code types itself out, then on to the Vercel island, where the deploy ripples
 * out under the triangle. One eight second loop drives all of it.
 *
 * Everything is tinted from the page's own colours, so it sits softly in light
 * and dark, and every animation stops for people who prefer less motion.
 */

const U = 20;
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
const LOOP = "8s";

type Point = [number, number];

/** Isometric projection: +x runs down to the right, +y down to the left, +z straight up. */
function p(x: number, y: number, z: number): Point {
  return [(x - y) * COS * U, (x + y) * SIN * U - z * U];
}

const f = (value: number) => value.toFixed(2);

/** A matrix that lays flat drawing, in model units, onto the horizontal plane at height z. */
function plane(z: number): string {
  const [ox, oy] = p(0, 0, z);
  return `matrix(${f(COS * U)} ${f(SIN * U)} ${f(-COS * U)} ${f(SIN * U)} ${f(ox)} ${f(oy)})`;
}

const pathOf = (points: [number, number, number][]) => points.map(([x, y, z], index) => `${index ? "L" : "M"} ${f(p(x, y, z)[0])} ${f(p(x, y, z)[1])}`).join(" ");

/**
 * A rounded slab: the same rounded rectangle at the bottom and the top, joined
 * between the two points where its outline turns, so it reads as one solid.
 */
function Slab({ x, y, z, w, d, r, t, className, children }: { x: number; y: number; z: number; w: number; d: number; r: number; t: number; className?: string; children?: ReactNode }) {
  const k = r / Math.SQRT2;
  const leftTurn = [x + r - k, y + d - r + k] as const;
  const rightTurn = [x + w - r + k, y + r - k] as const;
  const [ltx, lty] = p(leftTurn[0], leftTurn[1], z);
  const [lbx, lby] = p(leftTurn[0], leftTurn[1], z - t);
  const [rtx, rty] = p(rightTurn[0], rightTurn[1], z);
  const [rbx, rby] = p(rightTurn[0], rightTurn[1], z - t);
  return (
    <g className={className}>
      <g transform={plane(z - t)}>
        <rect x={x} y={y} width={w} height={d} rx={r} className="iso-side" />
      </g>
      <polygon points={`${f(ltx)},${f(lty)} ${f(rtx)},${f(rty)} ${f(rbx)},${f(rby)} ${f(lbx)},${f(lby)}`} className="iso-wall" />
      <line x1={f(ltx)} y1={f(lty)} x2={f(lbx)} y2={f(lby)} className="iso-edge" />
      <line x1={f(rtx)} y1={f(rty)} x2={f(rbx)} y2={f(rby)} className="iso-edge" />
      <g transform={plane(z)}>
        <rect x={x} y={y} width={w} height={d} rx={r} className="iso-top" />
      </g>
      {children}
    </g>
  );
}

/** A round tile: a disc standing on the plane, with its kind's icon on top. */
function Disc({ cx, cy, z, r, t, kind }: { cx: number; cy: number; z: number; r: number; t: number; kind: CanvasNodeKind }) {
  return (
    <Slab x={cx - r} y={cy - r} z={z + t} w={r * 2} d={r * 2} r={r} t={t}>
      <g transform={plane(z + t)}>
        <circle cx={cx} cy={cy} r={r * 0.72} className="iso-inner" />
        <g transform={`translate(${f(cx - r * 0.6)} ${f(cy - r * 0.6)}) scale(${f((r * 1.2) / 24)})`} className="iso-glyph" data-kind={kind}>
          {KINDS[kind].icon.nodes.map(([tag, attributes], index) => createElement(tag, { key: index, ...attributes, vectorEffect: "non-scaling-stroke" }))}
        </g>
      </g>
    </Slab>
  );
}

/** A soft rounded shadow on the ground under an island. */
function Shadow({ x, y, z, w, d, r }: { x: number; y: number; z: number; w: number; d: number; r: number }) {
  return (
    <g transform={plane(z)}>
      <rect x={x} y={y} width={w} height={d} rx={r} className="iso-shadow" />
    </g>
  );
}

/** A tube between islands, with a pulse that travels it once per loop between two moments. */
function Tube({ points, from, to }: { points: [number, number, number][]; from: number; to: number }) {
  const d = pathOf(points);
  return (
    <g>
      <path d={d} className="iso-tube-outer" />
      <path d={d} className="iso-tube-inner" />
      <g className="iso-motion">
        <circle r={4.2} className="iso-pulse">
          <animateMotion dur={LOOP} repeatCount="indefinite" path={d} keyPoints="0;0;1;1" keyTimes={`0;${from};${to};1`} calcMode="linear" />
          <animate attributeName="opacity" dur={LOOP} repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes={`0;${from - 0.001};${from};${to};${to + 0.02};1`} />
        </circle>
      </g>
    </g>
  );
}

// Heights of the three islands: each one lower than the last, like steps.
const LAB = { x: 0, y: 0, z: 3.6, w: 9, d: 8, r: 1.3, t: 0.7 };
const EVE = { x: 12, y: 1.5, z: 1.8, w: 6, d: 5, r: 1.1, t: 0.6 };
const SHIP = { x: 12.5, y: 10.5, z: 0, w: 6, d: 6, r: 1.2, t: 0.6 };

/** The drawing on its own, so the share image can render it too. */
export function HeroIllustration() {
  const dots: ReactNode[] = [];
  for (let gx = 1; gx < LAB.w; gx++) {
    for (let gy = 1; gy < LAB.d; gy++) dots.push(<circle key={`${gx}-${gy}`} cx={gx} cy={gy} r={0.05} className="iso-dot" />);
  }

  // Where the dragged connection lands, and the screen offset the drag starts from.
  const landing = p(7.2, 6.1, LAB.z + 0.3);
  const codeLines = [2.8, 3.8, 2.4, 3.2, 1.6];
  const shipCentre: [number, number] = [SHIP.x + SHIP.w / 2, SHIP.y + SHIP.d / 2];

  // The Vercel mark lying on its platform: a low triangular solid, its tip pointing straight back.
  const [cx, cy] = shipCentre;
  const lift = SHIP.z + 0.32;
  const apex: [number, number] = [cx - 1.15, cy - 1.15];
  const baseLeft: [number, number] = [cx - 0.42, cy + 1.5];
  const baseRight: [number, number] = [cx + 1.5, cy - 0.42];
  const pt = ([x, y]: [number, number], z: number) => p(x, y, z).map(f).join(",");
  const prism = (
    <>
      <polygon points={[pt(baseLeft, SHIP.z), pt(baseRight, SHIP.z), pt(baseRight, lift), pt(baseLeft, lift)].join(" ")} className="iso-prism-side" />
      <polygon points={[pt(apex, lift), pt(baseRight, lift), pt(baseLeft, lift)].join(" ")} className="iso-prism-front" />
    </>
  );

  return (
    <svg className="iso" viewBox="-156 -96 458 486" role="img" aria-label="Design an agent on the evelab canvas, get its code with eve, and ship it on Vercel">
      <Shadow x={LAB.x + 0.8} y={LAB.y + 0.8} z={LAB.z - LAB.t - 1.1} w={LAB.w - 1.2} d={LAB.d - 1.2} r={LAB.r} />
      <Shadow x={EVE.x + 0.6} y={EVE.y + 0.6} z={EVE.z - EVE.t - 1} w={EVE.w - 1} d={EVE.d - 1} r={EVE.r} />
      <Shadow x={SHIP.x + 0.6} y={SHIP.y + 0.6} z={SHIP.z - SHIP.t - 1} w={SHIP.w - 1} d={SHIP.d - 1} r={SHIP.r} />

      {/* evelab to eve, then eve to Vercel. */}
      <Tube points={[[LAB.x + LAB.w - 0.2, 4, LAB.z - 0.35], [10.5, 4, LAB.z - 0.35], [10.5, 4, EVE.z - 0.3], [EVE.x + 0.2, 4, EVE.z - 0.3]]} from={0.62} to={0.72} />
      <Tube points={[[15, EVE.y + EVE.d - 0.2, EVE.z - 0.3], [15, 8.5, EVE.z - 0.3], [15, 8.5, SHIP.z - 0.3], [15, SHIP.y + 0.2, SHIP.z - 0.3]]} from={0.84} to={0.93} />

      {/* 1. The evelab canvas. */}
      <g className="iso-bob">
        <Slab {...LAB}>
          <g transform={plane(LAB.z)}>
            {dots}
            {/* Wires from the agent card out to its pieces; the last one draws in when the drop lands. */}
            <path d="M 4.2 3.6 L 4.2 2 Q 4.2 1.6 3.8 1.6 L 2.45 1.6" className="iso-wire" />
            <path d="M 3.2 4.6 L 1.6 4.6 Q 1.4 4.6 1.4 4.8 L 1.4 5.35" className="iso-wire" />
            <path d="M 6.2 3.6 L 6.2 1.8 Q 6.2 1.5 6.5 1.5 L 6.95 1.5" className="iso-wire" />
            <path d="M 5.6 5.4 L 5.6 5.9 Q 5.6 6.1 5.8 6.1 L 6.45 6.1" className="iso-wire iso-wire-new" pathLength={1} />
            <circle cx={7.2} cy={6.1} r={0.9} className="iso-slot" />
            <text x={0.9} y={7.35} fontSize={0.62} className="iso-name">
              evelab
            </text>
          </g>
          {/* The agent card. */}
          <Slab x={3.2} y={3.6} z={LAB.z + 0.35} w={3.6} d={1.8} r={0.45} t={0.35}>
            <g transform={plane(LAB.z + 0.35)}>
              <rect x={3.45} y={3.9} width={1.2} height={1.2} rx={0.3} className="iso-ink" />
              <rect x={4.9} y={4.1} width={1.5} height={0.26} rx={0.13} className="iso-bar" />
              <rect x={4.9} y={4.6} width={0.9} height={0.22} rx={0.11} className="iso-bar iso-bar-soft" />
            </g>
          </Slab>
          <Disc cx={1.9} cy={1.6} z={LAB.z} r={0.6} t={0.3} kind="channel" />
          <Disc cx={1.4} cy={6} z={LAB.z} r={0.6} t={0.3} kind="tool" />
          <Disc cx={7.6} cy={1.5} z={LAB.z} r={0.6} t={0.3} kind="skill" />
        </Slab>
        {/* The connection being dragged in, with the cursor that carries it. */}
        <g className="iso-drag">
          <Disc cx={7.2} cy={6.1} z={LAB.z} r={0.75} t={0.3} kind="connection" />
        </g>
        <path
          className="iso-cursor"
          transform={`translate(${f(landing[0] + 8)} ${f(landing[1] - 6)})`}
          d="M0 0 L0 16 L4.4 12 L7.4 18.6 L10.2 17.4 L7.2 10.8 L13 10.8 Z"
        />
      </g>

      {/* 2. eve: the agent's code, typing out. */}
      <g className="iso-bob iso-bob-2">
        <Slab {...EVE}>
          <g transform={plane(EVE.z)}>
            <text x={12.6} y={6.3} fontSize={0.5} className="iso-name">
              eve
            </text>
          </g>
          <Slab x={12.6} y={2} z={EVE.z + 0.18} w={4.8} d={3.6} r={0.45} t={0.18}>
            <g transform={plane(EVE.z + 0.18)}>
              <line x1={12.6} y1={2.9} x2={17.4} y2={2.9} className="iso-rule" />
              {[13, 13.35, 13.7].map((cx) => (
                <circle key={cx} cx={cx} cy={2.5} r={0.11} className="iso-bar" />
              ))}
              {codeLines.map((length, index) => (
                <rect
                  key={index}
                  x={13 + (index === 1 || index === 2 ? 0.4 : 0)}
                  y={3.3 + index * 0.5}
                  width={length}
                  height={0.22}
                  rx={0.11}
                  className={`iso-bar iso-type iso-type-${index}`}
                />
              ))}
            </g>
          </Slab>
        </Slab>
      </g>

      {/* 3. Vercel: the deploy rippling out under the triangle. */}
      <g className="iso-bob iso-bob-3">
        <Slab {...SHIP}>
          <g transform={plane(SHIP.z)}>
            {[0, 1, 2].map((ring) => (
              <circle key={ring} cx={shipCentre[0]} cy={shipCentre[1]} r={2.3} className={`iso-ring iso-ring-${ring}`} />
            ))}
            <text x={SHIP.x + 0.7} y={SHIP.y + SHIP.d - 0.55} fontSize={0.5} className="iso-name">
              vercel
            </text>
          </g>
          {prism}
        </Slab>
      </g>

    </svg>
  );
}

export function HeroScene() {
  return (
    <figure className="iso-figure">
      <HeroIllustration />
    </figure>
  );
}
