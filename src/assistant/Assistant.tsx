import { useState, type FormEvent } from "react";
import { useStore } from "../store";
import { answerFor, TEMPLATES, type Answer, type Scope } from "./templates";

type Turn = { q: string; answer: Answer; templateId: string | null; nearest: string | null };

// Floating panel on the college and AICTE pages. Students and verifiers do not get the assistant.
export function Assistant() {
  const { session } = useStore();
  const [open, setOpen] = useState(false);
  if (!session || (session.role !== "college" && session.role !== "aicte")) return null;
  return (
    <>
      <button className="assist-fab" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="sentinel-assistant">
        {open ? "Close assistant" : "Ask Sentinel Assistant"}
      </button>
      {open && (
        <div className="assist" id="sentinel-assistant" role="dialog" aria-label="Sentinel Assistant">
          <div className="row between">
            <b>Sentinel Assistant</b>
            <button onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <AssistantBody scope={session.role === "aicte" ? "aicte" : "college"} />
        </div>
      )}
    </>
  );
}

// The conversation itself. Used in the floating panel and on the AICTE query page.
export function AssistantBody({ scope }: { scope: Scope }) {
  const { data, session, log } = useStore();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const instId = session?.institutionId ?? null;
  const examples = TEMPLATES.filter(t => t.scopes.includes(scope)).slice(0, 4).map(t => t.example);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const res = answerFor(q, { data, scope, instId });
    log("assistant.query", `${res.templateId ?? "refused"} · ${q.slice(0, 80)}`);
    setTurns(t => [...t, { q, answer: res.answer, templateId: res.templateId, nearest: res.nearest }]);
    setInput("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="stack">
      <div className="row">
        {examples.map(ex => (
          <button key={ex} onClick={() => ask(ex)}>{ex}</button>
        ))}
      </div>
      {turns.length === 0 && (
        <div className="small muted">Ask in plain English. Each answer comes from one approved template, shown under the reply.</div>
      )}
      {turns.map((t, i) => (
        <div key={i} className="stack">
          <div className="small"><b>You:</b> {t.q}</div>
          <div className="bubble">
            <div>{t.answer.text}</div>
            {t.answer.rows && t.answer.headers && (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="tbl">
                  <thead><tr>{t.answer.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {t.answer.rows.map((r, j) => (
                      <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="small muted" style={{ marginTop: 6 }}>
              {t.templateId
                ? <>Answered by template: <span className="mono">{t.templateId}</span></>
                : <>Not answered. Nearest supported question: <button onClick={() => t.nearest && ask(t.nearest)}>{t.nearest}</button></>}
            </div>
          </div>
        </div>
      ))}
      <form className="row" onSubmit={submit}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about intake, flags, uploads…" aria-label="Question" style={{ flex: 1 }} />
        <button className="primary" type="submit" disabled={!input.trim()}>Ask</button>
      </form>
    </div>
  );
}
