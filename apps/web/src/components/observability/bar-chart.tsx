"use client";

import { useId, useState } from "react";

export interface BarDatum {
  /** Stable key, such as a YYYY-MM-DD day. */
  key: string;
  /** Short axis label, such as "Sep 13". */
  label: string;
  value: number;
}

const HEIGHT = 140;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/**
 * One series of columns over time: a thin bar per day grown from a shared
 * baseline, a recessive grid, a tooltip on hover and keyboard focus, and the
 * same numbers as a table for anyone who does not read the chart. A single
 * series, so the card title names it and there is no legend.
 */
export function BarChart({
  data,
  format,
  label,
}: {
  data: BarDatum[];
  format: (value: number) => string;
  /** What the chart shows, for the accessible name and the table caption. */
  label: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number>();
  const max = niceMax(Math.max(0, ...data.map((datum) => datum.value)));
  const width = 100;
  const activeDatum = active === undefined ? undefined : data[active];

  return (
    <div className="bar-chart">
      <div className="bar-chart-plot">
        <div className="bar-chart-ticks" aria-hidden="true">
          <span>{format(max)}</span>
          <span>{format(max / 2)}</span>
          <span>{format(0)}</span>
        </div>
        <div className="bar-chart-area">
          <svg
            className="bar-chart-svg"
            viewBox={`0 0 ${width} ${HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${label}, ${data.length} days`}
            aria-describedby={`${id}-table`}
          >
            {[0, 0.5, 1].map((fraction) => (
              <line key={fraction} className="bar-chart-grid" x1={0} x2={width} y1={HEIGHT * fraction} y2={HEIGHT * fraction} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="bar-chart-bars" onPointerLeave={() => setActive(undefined)}>
            {data.map((datum, index) => {
              return (
                <button
                  key={datum.key}
                  type="button"
                  className="bar-chart-slot"
                  data-active={active === index || undefined}
                  aria-label={`${datum.label}: ${format(datum.value)}`}
                  onPointerEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(undefined)}
                >
                  {datum.value > 0 && (
                    // Drawn in CSS so the rounded top keeps its radius at any width.
                    <span className="bar-chart-bar" style={{ height: `${(datum.value / max) * 100}%` }} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
          {activeDatum && active !== undefined && (
            <div
              className="bar-chart-tooltip"
              role="status"
              style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
            >
              <span className="bar-chart-tooltip-value">{format(activeDatum.value)}</span>
              <span className="bar-chart-tooltip-label">{activeDatum.label}</span>
            </div>
          )}
        </div>
      </div>
      <div className="bar-chart-axis" aria-hidden="true">
        <span>{data[0]?.label}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
      <details className="bar-chart-table">
        <summary className="hint">View as table</summary>
        <table id={`${id}-table`}>
          <caption className="visually-hidden">{label}</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.key}>
                <td>{datum.label}</td>
                <td className="tabular-nums">{format(datum.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
