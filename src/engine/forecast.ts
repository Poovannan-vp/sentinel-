// Explainable pace projection: least-squares slope over the last `window` snapshots.
// The range uses a low and a high slope (±30%) so the breach date is shown as a window.

export type Forecast = {
  slope: number;        // admissions per day
  lastValue: number;
  breachDay: number | null;
  breachRange: [number, number] | null;   // [earliest, latest] day of breach
  projectedFinal: number;
  finalRange: [number, number];
};

function slopeOf(values: number[]): number {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (values[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function project(snapshots: number[], intake: number, window = 7, horizon = 30): Forecast {
  const recent = snapshots.slice(-window);
  const slope = slopeOf(recent);
  const lastValue = snapshots[snapshots.length - 1];
  const lowSlope = slope * 0.7;
  const highSlope = slope * 1.3;

  // days until the pace reaches intake; null if the pace never gets there
  const daysTo = (s: number): number | null => {
    if (lastValue >= intake) return 0;
    if (s <= 0) return null;
    return Math.ceil((intake - lastValue) / s);
  };
  const d = daysTo(slope);
  const dLow = daysTo(highSlope);   // faster pace breaches sooner
  const dHigh = daysTo(lowSlope);   // slower pace breaches later

  const at = (s: number, day: number) => lastValue + s * day;
  return {
    slope,
    lastValue,
    breachDay: d,
    breachRange: d === null ? null : [dLow ?? d, dHigh ?? d],
    projectedFinal: Math.round(at(slope, horizon)),
    finalRange: [Math.round(at(lowSlope, horizon)), Math.round(at(highSlope, horizon))],
  };
}
