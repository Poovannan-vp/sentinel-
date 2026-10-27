import type { ReactNode } from "react";
import { useStore } from "../store";

// Every page opens with the same header: where it sits in the PDF, a title, and one plain sentence.
// `pdf` is the section reference; `ref` would be stripped by React and never reach the component.
export function PageHead({ section, title, lead, pdf, right }: {
  section: string; title: string; lead: string; pdf?: string; right?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{section}{pdf ? ` · ${pdf}` : ""}</div>
        <h1>{title}</h1>
        <p>{lead}</p>
      </div>
      {right && <div className="row">{right}</div>}
    </div>
  );
}

export function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="card metric">
      <div className="label">{label}</div>
      <div className="big">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</div>
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export function Chip({ tone, children }: { tone: "ok" | "warn" | "flag" | "info" | "neutral"; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function Empty({ title, next }: { title: string; next?: string }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {next && <span>{next}</span>}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          <span>{t.text}</span>
          {t.undo && <button onClick={() => { t.undo?.(); dismissToast(t.id); }}>Undo</button>}
          <button onClick={() => dismissToast(t.id)} aria-label="Close message">×</button>
        </div>
      ))}
    </div>
  );
}

// Utilisation bar with the status written next to it, never colour alone.
export function UtilBar({ pct }: { pct: number }) {
  const cls = pct > 100 ? "over" : pct >= 95 ? "near" : "";
  return (
    <div className="util">
      <div className="util-track"><div className={`util-bar ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <span className="num">{pct}%</span>
    </div>
  );
}
