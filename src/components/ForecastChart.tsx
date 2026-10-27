import type { Programme } from "../data/seed";
import { project } from "../engine/forecast";

// Actual admissions, projected pace with a range band, and the intake limit.
// pace scales the growth since the first snapshot, so the recent slope scales by the same factor
export function ForecastChart({ prog, pace = 1 }: { prog: Programme; pace?: number }) {
  const snaps = prog.snapshots.map(v => prog.snapshots[0] + (v - prog.snapshots[0]) * pace);
  const f = project(snaps, prog.intake);
  const horizon = 30;
  const W = 640, H = 240, pad = { l: 44, r: 16, t: 16, b: 28 };
  const maxY = Math.max(120, prog.intake + 10);
  const x = (d: number) => pad.l + (d / horizon) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);

  const actual = snaps.map((v, d) => `${x(d)},${y(v)}`).join(" ");
  const last = snaps.length - 1;
  const proj = `${x(last)},${y(f.lastValue)} ${x(horizon)},${y(f.lastValue + f.slope * (horizon - last))}`;
  const band = [
    `${x(last)},${y(f.lastValue)}`,
    `${x(horizon)},${y(f.lastValue + f.slope * 1.3 * (horizon - last))}`,
    `${x(horizon)},${y(f.lastValue + f.slope * 0.7 * (horizon - last))}`,
  ].join(" ");

  const breachX = f.breachDay !== null ? x(last + f.breachDay) : null;
  const breachY = y(prog.intake);
  const ticks = [0, Math.round(maxY / 2), maxY].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="forecast">
      <div className="ledger-head">
        <div>
          <div className="label">Breach forecast · pace from last 7 days</div>
          <div className="big">
            {f.breachDay !== null
              ? <>Breach in <span className="warn">{f.breachDay} days</span></>
              : <>No breach projected</>}
          </div>
        </div>
        <div className="muted small">
          range {f.breachRange ? `${f.breachRange[0]}–${f.breachRange[1]} days` : "n/a"} · projected final {f.projectedFinal}
          {" "}(range {f.finalRange[0]}–{f.finalRange[1]})
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="forecast-svg" role="img" aria-label={`admissions forecast for ${prog.name}`}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={pad.l - 8} y={y(v) + 4} className="axis" textAnchor="end">{v}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={breachY} y2={breachY} className="intake-line" />
        <text x={W - pad.r} y={breachY - 6} className="axis warn" textAnchor="end">intake {prog.intake}</text>
        <polygon points={band} className="band" />
        <polyline points={actual} className="actual" />
        <polyline points={proj} className="projection" />
        {breachX !== null && (
          <g>
            <circle cx={breachX} cy={breachY} r={6} className="marker" />
            <text x={breachX} y={breachY + 20} className="axis warn" textAnchor="middle">breach</text>
          </g>
        )}
        {[0, 10, 20, 30].map(d => (
          <text key={d} x={x(d)} y={H - 8} className="axis" textAnchor="middle">day {d}</text>
        ))}
      </svg>
    </div>
  );
}
