import type { Programme } from "../data/seed";

// Each admission category as a share of approved intake, the way the quota is read in an approval review.
const CATEGORIES: { key: "supernumerary" | "nri" | "oci" | "fn"; label: string; note: string }[] = [
  { key: "supernumerary", label: "Supernumerary", note: "Beyond approved intake" },
  { key: "nri", label: "NRI", note: "Non-resident Indian" },
  { key: "oci", label: "OCI / PIO", note: "Overseas citizen or person of Indian origin" },
  { key: "fn", label: "Foreign national", note: "FN" },
];

export function QuotaGauges({ prog }: { prog: Programme }) {
  return (
    <div className="card quota">
      <div className="label">Quota categories · share of approved intake {prog.intake}</div>
      {CATEGORIES.map(c => {
        const n = prog[c.key];
        const pct = Math.min(100, Math.round((n / prog.intake) * 100));
        return (
          <div key={c.key} className="quota-row">
            <div className="quota-name">
              <b>{c.label}</b> <span className="muted small">{c.note}</span>
            </div>
            <div className="quota-bar" role="img" aria-label={`${c.label}: ${n} of ${prog.intake}`}>
              <span style={{ width: `${Math.max(pct, n > 0 ? 2 : 0)}%` }} />
            </div>
            <div className="quota-num">{n} <span className="muted small">({pct}%)</span></div>
          </div>
        );
      })}
    </div>
  );
}
