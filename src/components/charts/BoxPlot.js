import React, { useMemo } from 'react';

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function fiveNumberSummary(values) {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
  };
}

/**
 * Lightweight SVG box plot (variability/distribution) — Recharts has no native box plot, and a
 * hand-rolled SVG keeps this small and easy to read for students at a glance.
 * `groups`: [{ label, values: number[], color? }]
 */
const BoxPlot = ({ groups, unit = '', height = 300, color = '#0EA5E9' }) => {
  const summaries = useMemo(
    () =>
      groups
        .map((g) => ({ label: g.label, color: g.color || color, summary: fiveNumberSummary(g.values) }))
        .filter((g) => g.summary),
    [groups, color]
  );

  if (!summaries.length) {
    return <p className="text-sm text-gray-500 py-12 text-center">Not enough data points for a box plot yet.</p>;
  }

  const allValues = summaries.flatMap((g) => [g.summary.min, g.summary.max]);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const pad = (dataMax - dataMin) * 0.1 || 1;
  const scaleMin = dataMin - pad;
  const scaleMax = dataMax + pad;

  const chartHeight = height;
  const chartWidth = Math.max(320, summaries.length * 110);
  const marginTop = 20;
  const marginBottom = 30;
  const plotHeight = chartHeight - marginTop - marginBottom;

  const yFor = (v) => marginTop + plotHeight - ((v - scaleMin) / (scaleMax - scaleMin)) * plotHeight;
  const colWidth = chartWidth / summaries.length;
  const boxWidth = Math.min(56, colWidth * 0.5);

  const yTicks = 5;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => scaleMin + ((scaleMax - scaleMin) * i) / yTicks);

  return (
    <div className="overflow-x-auto">
      <svg width={chartWidth} height={chartHeight} role="img" aria-label="Box plot of variability/distribution">
        {/* Y axis line + gridlines/ticks, with units labeled per the "chart good defaults" rule */}
        <line x1={40} y1={marginTop} x2={40} y2={chartHeight - marginBottom} stroke="#9CA3AF" strokeWidth={1} />
        {tickValues.map((t, i) => (
          <g key={i}>
            <line x1={36} y1={yFor(t)} x2={chartWidth} y2={yFor(t)} stroke="#F1F5F9" strokeWidth={1} />
            <text x={32} y={yFor(t)} fontSize="10" fill="#6B7280" textAnchor="end" dominantBaseline="middle">
              {Math.round(t * 100) / 100}
            </text>
          </g>
        ))}
        <text x={4} y={marginTop - 6} fontSize="10" fill="#6B7280">
          {unit}
        </text>

        {summaries.map((g, i) => {
          const cx = 40 + colWidth * (i + 0.5);
          const { min, q1, median, q3, max } = g.summary;
          return (
            <g key={g.label}>
              {/* whiskers */}
              <line x1={cx} y1={yFor(min)} x2={cx} y2={yFor(q1)} stroke={g.color} strokeWidth={1.5} />
              <line x1={cx} y1={yFor(q3)} x2={cx} y2={yFor(max)} stroke={g.color} strokeWidth={1.5} />
              <line x1={cx - 10} y1={yFor(min)} x2={cx + 10} y2={yFor(min)} stroke={g.color} strokeWidth={1.5} />
              <line x1={cx - 10} y1={yFor(max)} x2={cx + 10} y2={yFor(max)} stroke={g.color} strokeWidth={1.5} />
              {/* box (Q1–Q3) */}
              <rect
                x={cx - boxWidth / 2}
                y={yFor(q3)}
                width={boxWidth}
                height={Math.max(1, yFor(q1) - yFor(q3))}
                fill={`${g.color}33`}
                stroke={g.color}
                strokeWidth={1.5}
              />
              {/* median line */}
              <line x1={cx - boxWidth / 2} y1={yFor(median)} x2={cx + boxWidth / 2} y2={yFor(median)} stroke={g.color} strokeWidth={2} />
              {/* x axis label */}
              <text x={cx} y={chartHeight - marginBottom + 16} fontSize="11" fill="#374151" textAnchor="middle" fontWeight="600">
                {g.label}
              </text>
            </g>
          );
        })}
        <line
          x1={40}
          y1={chartHeight - marginBottom}
          x2={chartWidth}
          y2={chartHeight - marginBottom}
          stroke="#9CA3AF"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};

export default BoxPlot;
