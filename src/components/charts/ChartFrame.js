import React from 'react';

/**
 * Sections a chart so axis captions and the legend never collide with the plot
 * (Recharts' insideBottom "Day" label + <Legend /> was stacking on the same band).
 *
 * Layout:
 *   [optional y-axis caption]
 *   [plot — children]
 *   [optional x-axis caption]
 *   [optional HTML legend row]
 *
 * Pass a numeric `height` for fixed plot area (Analysis cards), or omit it and
 * set `className="h-full"` so the plot flex-grows (Workspace cards).
 */
export default function ChartFrame({
  children,
  height,
  xLabel = '',
  yLabel = '',
  legendItems = [],
  className = '',
}) {
  const fixedHeight = typeof height === 'number';
  return (
    <div data-chart-frame="true" className={`flex w-full flex-col gap-2 ${className}`}>
      {yLabel ? (
        <p
          data-chart-ylabel="true"
          className="shrink-0 text-[11px] font-semibold tracking-wide text-gray-500"
        >
          {yLabel}
        </p>
      ) : null}
      <div
        data-chart-plot="true"
        className={fixedHeight ? 'w-full shrink-0' : 'min-h-0 w-full flex-1'}
        style={fixedHeight ? { height } : undefined}
      >
        {children}
      </div>
      {xLabel ? (
        <p
          data-chart-xlabel="true"
          className="shrink-0 text-center text-[11px] font-semibold tracking-wide text-gray-500"
        >
          {xLabel}
        </p>
      ) : null}
      {legendItems.length > 0 ? (
        <ul
          data-chart-legend="true"
          className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-2"
        >
          {legendItems.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600"
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
