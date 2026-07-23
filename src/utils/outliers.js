/**
 * Simple IQR-based outlier flagging for classroom discussion ("surprising readings"),
 * not a statistical test — deliberately excludes standard deviation / regression per scope.
 */
export function detectOutliers(points, getValue = (p) => p.value) {
  const values = points.map(getValue).filter((v) => Number.isFinite(v));
  if (values.length < 4) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q) => {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    return sorted[base + 1] !== undefined
      ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
      : sorted[base];
  };
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return points
    .map((p) => ({ point: p, value: getValue(p) }))
    .filter(({ value }) => Number.isFinite(value) && (value < lowerBound || value > upperBound))
    .map(({ point, value }) => ({ point, value, direction: value > upperBound ? 'high' : 'low' }));
}
