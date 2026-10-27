import { useState } from "react";
import { useStore } from "../store";
import { INSTITUTIONS, ROSTER, DEMO_USERS, CATEGORIES, type Programme, type Flag } from "../data/seed";
import { activeOf, statusLabel, utilisation } from "../engine/programme";
import { project } from "../engine/forecast";
import { ghostSeats, type RowStatus } from "../engine/rules";
import { parseCsv, SAMPLE_CSV, toCsv, download } from "../engine/csv";
import { validateUpload, summarise, type RowResult, type UploadRow } from "../engine/upload";
import { maskApaar } from "../engine/format";
import { ForecastChart } from "../components/ForecastChart";
import { QuotaGauges } from "../components/QuotaGauges";
import { PageHead, Metric, Chip, Empty, UtilBar } from "../components/ui";
import { PAGES, type PageKey } from "../auth/roles";
import { go } from "../App";
import type { Institution as Inst } from "../data/seed";

// College administrator pages. Every query is scoped to the signed-in institution.
export function Institution({ page }: { page: PageKey }) {
  const { session, data } = useStore();
  const inst = INSTITUTIONS.find(i => i.id === session?.institutionId) as Inst;
  const scopedFlags = data.flags.filter(f => f.instId === inst.id);

  switch (page) {
    case "dashboard": return <Dashboard inst={inst} flags={scopedFlags} />;
    case "programmes": return <Programmes inst={inst} />;
    case "upload": return <Upload inst={inst} />;
    case "records": return <Records inst={inst} />;
    case "forecast": return <Forecast inst={inst} />;
    case "flags": return <FlagsInbox flags={scopedFlags} />;
    case "ghost": return <GhostReview inst={inst} flags={scopedFlags} />;
    case "reports": return <Reports inst={inst} />;
    case "users": return <Users inst={inst} />;
    default: return <Empty title={`${PAGES[page].label} is not part of this portal.`} />;
  }
}

export function activeMap(progs: Programme[], deltas: Record<string, number>) {
  return progs.map(p => {
    const active = activeOf(p, deltas);
    const f = project(p.snapshots, p.intake);
    return { p, active, util: utilisation(active, p.intake), breachDay: f.breachDay, status: statusLabel(active, p.intake, f.breachDay) };
  });
}

function Dashboard({ inst, flags }: { inst: Inst; flags: Flag[] }) {
  const { data } = useStore();
  const rows = activeMap(inst.programmes, data.deltas);
  const reported = inst.programmes.reduce((n, p) => n + p.reported, 0);
  const active = rows.reduce((n, r) => n + r.active, 0);
  const intake = inst.programmes.reduce((n, p) => n + p.intake, 0);
  const open = flags.filter(f => f.state === "open").length;
  const uploads = data.uploads.filter(u => u.instId === inst.id).slice(0, 3);
  return (
    <section>
      <PageHead section="Institution portal" title={inst.name} lead="Your admissions against approved intake, with open flags and recent uploads. Synthetic data." pdf="PDF 9.1" />
      <div className="grid g4">
        <Metric label="Reported admissions" value={reported} note="Raw counts from the college." />
        <Metric label="Active enrolment" value={active} note="Distinct, eligible, active rows." />
        <Metric label="Approved intake" value={intake} note="Sum across programmes." />
        <Metric label="Open flags" value={open} note="Waiting for an AICTE decision or a fix." />
      </div>
      <div className="grid g2 stack">
        <div className="card">
          <div className="label">Programmes</div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Programme</th><th className="num">Intake</th><th className="num">Active</th><th>Utilisation</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.p.id}>
                    <td>{r.p.name}</td>
                    <td className="num">{r.p.intake}</td>
                    <td className="num">{r.active}</td>
                    <td><UtilBar pct={r.util} /></td>
                    <td><Chip tone={r.status.tone === "ok" ? "ok" : r.status.tone === "warn" ? "warn" : "flag"}>{r.status.text}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="label">Next steps</div>
          <ol className="steps">
            <li><span className="n">1</span><span>Check the <a href="#/flags">Flags inbox</a> for anything AICTE has raised.</span></li>
            <li><span className="n">2</span><span>Fix correctable rows in the <a href="#/upload">Upload center</a> and resubmit.</span></li>
            <li><span className="n">3</span><span>Review the <a href="#/forecast">Admission forecast</a> before the next round.</span></li>
          </ol>
          <div className="label" style={{ marginTop: 16 }}>Recent uploads</div>
          {uploads.length === 0 && <Empty title="No uploads yet." next="Open the Upload center to submit a batch." />}
          {uploads.map(u => (
            <div key={u.id} className="small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <b>{u.id}</b> · {u.file} · {u.at}
              <div className="muted">{u.accepted} accepted · {u.correctable} correctable · {u.review} review</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Programmes({ inst }: { inst: Inst }) {
  const { data } = useStore();
  const rows = activeMap(inst.programmes, data.deltas);
  return (
    <section>
      <PageHead section="Institution portal" title="Programmes and intake" lead="Approved intake per programme, with the admission categories AICTE counts separately." pdf="PDF 9.1" />
      <div className="card table-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Programme</th><th className="num">Approved intake</th><th className="num">Active</th><th className="num">Supernumerary</th><th className="num">NRI</th><th className="num">OCI/PIO</th><th className="num">FN</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.p.id}>
                <td><b>{r.p.name}</b></td>
                <td className="num">{r.p.intake}</td>
                <td className="num">{r.active}</td>
                <td className="num">{r.p.supernumerary}</td>
                <td className="num">{r.p.nri}</td>
                <td className="num">{r.p.oci}</td>
                <td className="num">{r.p.fn}</td>
                <td><Chip tone={r.status.tone === "ok" ? "ok" : r.status.tone === "warn" ? "warn" : "flag"}>{r.status.text}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Approved intake is versioned. Changes need an AICTE request; they are not overwritten.</p>
    </section>
  );
}

// Upload center: check, see every row's status, fix correctable rows, then accept the valid ones.
function Upload({ inst }: { inst: Inst }) {
  const { data, submitUpload, log, toast } = useStore();
  const [progId, setProgId] = useState(inst.programmes[0].id);
  const prog = inst.programmes.find(p => p.id === progId) as Programme;
  const active = activeOf(prog, data.deltas);
  const remaining = Math.max(0, prog.intake - active);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [accepted, setAccepted] = useState(false);

  const loadSample = () => {
    setFileName("sample_batch_messy.csv");
    setRows(parseCsv(SAMPLE_CSV));
    setResults(null);
    setAccepted(false);
    log("upload.loaded", `sample_batch_messy.csv · ${progId}`);
  };

  const loadFile = async (f: File) => {
    const text = await f.text();
    setFileName(f.name);
    setRows(parseCsv(text));
    setResults(null);
    setAccepted(false);
  };

  const check = () => setResults(validateUpload(rows, remaining));
  const summary = results ? summarise(results) : null;
  // one shape for checked and unchecked rows, so the table renders both the same way
  const view: { row: UploadRow; status: RowStatus | null; failed: string[]; reasons: string[] }[] =
    results ?? rows.map(row => ({ row, status: null, failed: [], reasons: [] }));

  const fixCategory = (line: number, category: string) => {
    setRows(rs => rs.map(r => (r.line === line ? { ...r, category } : r)));
    setResults(null);
  };

  const accept = () => {
    if (!summary) return;
    submitUpload({
      progId, instId: inst.id, file: fileName, rows: summary.rows,
      accepted: summary.accepted, correctable: summary.correctable, review: summary.review,
    });
    setAccepted(true);
    toast(`${summary.accepted} rows accepted. ${summary.correctable + summary.review} rows still need action.`);
  };

  const errorReport = () => {
    if (!results) return;
    const body = results.filter(r => r.status !== "accepted").map(r => [r.row.line, r.row.apaar, r.row.name, r.row.category, r.status, r.reasons.join("; ")]);
    download("error_report.csv", toCsv(["line", "apaar", "name", "category", "status", "reasons"], body));
    log("upload.error_report", `${fileName} · ${body.length} rows`);
  };

  return (
    <section>
      <PageHead section="Institution portal" title="Upload center" lead="Upload a batch. Valid rows are accepted; each error is explained, and you can fix it and check again." pdf="PDF 9.1 · section 7" />
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="small">Programme
            <select value={progId} onChange={e => { setProgId(e.target.value); setResults(null); setAccepted(false); }} style={{ display: "block", marginTop: 4 }}>
              {inst.programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="small muted">Seats left: <b>{remaining}</b> of {prog.intake}</div>
          <div className="row" style={{ marginLeft: "auto" }}>
            <button onClick={loadSample}>Use sample batch</button>
            <label className="small" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span>or choose a CSV</span>
              <input type="file" accept=".csv,text/csv" onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
            </label>
          </div>
        </div>
        {rows.length > 0 && (
          <p className="small muted" style={{ marginBottom: 0 }}>{fileName} · {rows.length} rows loaded. Columns: apaar, name, category, admission_date.</p>
        )}
      </div>

      {rows.length === 0 && <div className="stack"><Empty title="No batch loaded." next="Use the sample batch, or choose a CSV with the same columns." /></div>}

      {rows.length > 0 && (
        <div className="stack">
          <div className="row">
            <button className="primary" onClick={check}>Run checks</button>
            {summary && <button onClick={errorReport}>Download error report</button>}
          </div>
          {summary && (
            <div className="grid g4">
              <Metric label="Rows" value={summary.rows} />
              <Metric label="Accepted" value={summary.accepted} note="Valid, within seats left." />
              <Metric label="Correctable" value={summary.correctable} note="Fix the field and check again." />
              <Metric label="Needs review" value={summary.review} note="Duplicate or over intake." />
            </div>
          )}
          <div className="card table-wrap">
            <table className="tbl">
              <thead><tr><th className="num">Line</th><th>APAAR ID</th><th>Name</th><th>Category</th><th>Status</th><th>Why</th></tr></thead>
              <tbody>
                {view.map(r => (
                  <tr key={r.row.line}>
                    <td className="num">{r.row.line}</td>
                    <td className="mono">{maskApaar(r.row.apaar)}</td>
                    <td>{r.row.name}</td>
                    <td>
                      {r.status === "correctable" && r.failed.some(x => x === "CATEGORY" || x === "CATEGORY_CASE") ? (
                        <select value={r.row.category} onChange={e => fixCategory(r.row.line, e.target.value)} aria-label={`Category for line ${r.row.line}`}>
                          {!CATEGORIES.includes(r.row.category as typeof CATEGORIES[number]) && <option value={r.row.category}>{r.row.category || "(empty)"}</option>}
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : r.row.category || <span className="muted">(empty)</span>}
                    </td>
                    <td>
                      {r.status === null && <span className="muted small">not checked</span>}
                      {r.status === "accepted" && <Chip tone="ok">accepted</Chip>}
                      {r.status === "correctable" && <Chip tone="warn">correctable</Chip>}
                      {r.status === "review" && <Chip tone="flag">needs review</Chip>}
                    </td>
                    <td className="small">{r.reasons.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary && !accepted && (
            <div className="row">
              <button className="primary" onClick={accept} disabled={summary.accepted === 0}>Accept {summary.accepted} valid rows</button>
              <span className="small muted">Correctable and review rows stay in the batch. Nothing is dropped silently.</span>
            </div>
          )}
          {accepted && <div className="small ok">Accepted. The batch is in the upload history and the forecast has been updated.</div>}
        </div>
      )}
    </section>
  );
}

function Records({ inst }: { inst: Inst }) {
  const { log, toast } = useStore();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const roster = ROSTER.filter(r => r.instId === inst.id);
  const shown = roster.filter(r => (r.name + r.apaar).toLowerCase().includes(q.toLowerCase()));
  const current = roster.find(r => r.apaar === sel);
  const progName = (id: string) => inst.programmes.find(p => p.id === id)?.name ?? id;
  return (
    <section>
      <PageHead section="Institution portal" title="Student records" lead="Search your institution's records. APAAR IDs are masked on screen; the full ID is used for matching only." pdf="PDF 9.1 · section 6" />
      <div className="grid g2">
        <div className="card">
          <div className="row between"><input placeholder="Search name or APAAR ID" value={q} onChange={e => setQ(e.target.value)} aria-label="Search records" style={{ width: "100%" }} /></div>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="tbl">
              <thead><tr><th>Name</th><th>APAAR</th><th>Programme</th><th>Status</th></tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.apaar} className={sel === r.apaar ? "sel" : ""} onClick={() => setSel(r.apaar)} style={{ cursor: "pointer" }}>
                    <td>{r.name}</td>
                    <td className="mono">{maskApaar(r.apaar)}</td>
                    <td className="small">{progName(r.progId)}</td>
                    <td><Chip tone={r.status === "active" ? "ok" : "neutral"}>{r.status}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && <Empty title="No record matches." next="Try a shorter search." />}
        </div>
        <div className="card">
          {!current && <Empty title="Select a record" next="Click a row to see its details and correct the category." />}
          {current && (
            <>
              <div className="label">Record</div>
              <dl className="kv">
                <dt>Name</dt><dd>{current.name}</dd>
                <dt>APAAR ID</dt><dd className="mono">{maskApaar(current.apaar)}</dd>
                <dt>Programme</dt><dd>{progName(current.progId)}</dd>
                <dt>Admission date</dt><dd>{current.admissionDate}</dd>
                <dt>Status</dt><dd>{current.status}</dd>
                <dt>Category</dt>
                <dd>
                  <select value={edits[current.apaar] ?? current.category} onChange={e => setEdits({ ...edits, [current.apaar]: e.target.value })} aria-label="Category">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </dd>
              </dl>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="primary" onClick={() => {
                  log("record.corrected", `${maskApaar(current.apaar)} · category ${edits[current.apaar] ?? current.category}`);
                  toast("Record updated. The change is in the audit log.");
                }}>Save correction</button>
              </div>
              <p className="small muted">Corrections keep the previous value in the history. Only your institution's records are shown.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Forecast({ inst }: { inst: Inst }) {
  const { data } = useStore();
  const [progId, setProgId] = useState(inst.programmes[0].id);
  const [pace, setPace] = useState(100);
  const prog = inst.programmes.find(p => p.id === progId) as Programme;
  const active = activeOf(prog, data.deltas);
  const f = project(prog.snapshots, prog.intake);
  return (
    <section>
      <PageHead section="Institution portal" title="Admission forecast" lead="Projected admissions from the last seven days. Move the pace to see how the breach date changes." pdf="PDF 9.1 · section 5" />
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="small">Programme
            <select value={progId} onChange={e => setProgId(e.target.value)} style={{ display: "block", marginTop: 4 }}>
              {inst.programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="small" style={{ flex: 1, minWidth: 240 }}>Pace: {pace}% of the current rate
            <input type="range" min={50} max={150} step={5} value={pace} onChange={e => setPace(Number(e.target.value))} style={{ display: "block", width: "100%" }} />
          </label>
        </div>
      </div>
      <div className="grid g4 stack">
        <Metric label="Active now" value={active} note={`Intake ${prog.intake}`} />
        <Metric label="Projected final" value={f.projectedFinal} note={`Range ${f.finalRange[0]}–${f.finalRange[1]}`} />
        <Metric label="Breach in" value={f.breachDay === null ? "None projected" : `${f.breachDay} days`} note={f.breachRange ? `Range ${f.breachRange[0]}–${f.breachRange[1]} days` : "Pace does not reach intake"} />
        <Metric label="Ghost seats" value={ghostSeats(prog.reported, active)} note="Reported minus active." />
      </div>
      <div className="stack">
        <div className="card"><ForecastChart prog={prog} pace={pace / 100} /></div>
        <QuotaGauges prog={prog} />
      </div>
    </section>
  );
}

function FlagsInbox({ flags }: { flags: Flag[] }) {
  const { addNote } = useStore();
  const [sel, setSel] = useState<string | null>(flags[0]?.id ?? null);
  const [text, setText] = useState("");
  const f = flags.find(x => x.id === sel);
  return (
    <section>
      <PageHead section="Institution portal" title="Flags inbox" lead="Flags raised on your records. Each one shows its rule, the evidence, and what AICTE has decided." pdf="PDF 9.1 · section 2 (Pillar B)" />
      <div className="grid g2">
        <div className="card table-wrap">
          <table className="tbl">
            <thead><tr><th>ID</th><th>Flag</th><th>Rule</th><th>State</th></tr></thead>
            <tbody>
              {flags.map(x => (
                <tr key={x.id} className={sel === x.id ? "sel" : ""} onClick={() => setSel(x.id)} style={{ cursor: "pointer" }}>
                  <td className="mono">{x.id}</td>
                  <td>{x.title}</td>
                  <td className="mono small">{x.rule}</td>
                  <td><Chip tone={x.state === "open" ? "warn" : x.state === "escalated" ? "flag" : "neutral"}>{x.state}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
          {flags.length === 0 && <Empty title="No flags on your records." />}
        </div>
        <div className="card">
          {f && <FlagDetail flag={f} />}
          {f && (
            <div className="stack">
              <div className="label">Reply to AICTE</div>
              <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="For example: fee feed was down on 12th; re-sync requested." aria-label="Reply" />
              <div className="row">
                <button disabled={!text.trim()} onClick={() => { addNote(f.id, text.trim()); setText(""); }}>Add reply</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function FlagDetail({ flag }: { flag: Flag }) {
  return (
    <>
      <div className="row between"><b>{flag.title}</b><Chip tone={flag.state === "open" ? "warn" : flag.state === "escalated" ? "flag" : "neutral"}>{flag.state}</Chip></div>
      <dl className="kv" style={{ marginTop: 10 }}>
        <dt>Rule</dt><dd className="mono">{flag.rule}</dd>
        <dt>Confidence</dt><dd>{flag.confidence}</dd>
        <dt>Days</dt><dd>{flag.days}</dd>
        <dt>Missing signals</dt><dd>{flag.missingSignals.length ? flag.missingSignals.join(", ") : "none"}</dd>
      </dl>
      <div className="evidence small" style={{ marginTop: 10 }}><b>Evidence:</b> {flag.evidence}</div>
      {flag.reason && <div className="small" style={{ marginTop: 10 }}><b>Decision:</b> {flag.reason}</div>}
      {flag.notes.length > 0 && (
        <div className="stack" style={{ marginTop: 10 }}>
          <div className="label">Notes</div>
          {flag.notes.map((n, i) => <div key={i} className="small"><b>{n.author}</b> · {n.at}<div>{n.text}</div></div>)}
        </div>
      )}
    </>
  );
}

function GhostReview({ inst, flags }: { inst: Inst; flags: Flag[] }) {
  const { data } = useStore();
  const rows = activeMap(inst.programmes, data.deltas);
  const ghosts = rows.map(r => ({ ...r, ghost: ghostSeats(r.p.reported, r.active) }));
  return (
    <section>
      <PageHead section="Institution portal" title="Ghost-seat review" lead="A seat counts as real only if the student shows activity: fee payment, exam registration or attendance." pdf="PDF section 2 (Differentiator 1)" />
      <div className="grid g3">
        {ghosts.map(g => (
          <div key={g.p.id} className="card">
            <div className="label">{g.p.name}</div>
            <div className="big">{g.ghost} <span className="small muted">unverified seats</span></div>
            <div className="small muted">Reported {g.p.reported} · active {g.active}</div>
          </div>
        ))}
      </div>
      <div className="card stack">
        <div className="label">Signals checked</div>
        <p className="small" style={{ margin: 0 }}>Fee payment, exam registration and attendance feed. These are simulated in the demo.</p>
        {flags.filter(f => f.rule.startsWith("GS")).map(f => (
          <div key={f.id} className="evidence small"><b>{f.id} · {f.title}</b><div>{f.evidence}</div><div className="muted">Missing: {f.missingSignals.join(", ") || "none"}</div></div>
        ))}
        {flags.filter(f => f.rule.startsWith("GS")).length === 0 && <Empty title="No ghost-seat flags." />}
      </div>
    </section>
  );
}

function Reports({ inst }: { inst: Inst }) {
  const { data, log, toast } = useStore();
  const rows = activeMap(inst.programmes, data.deltas);
  const exportCsv = () => {
    download("institution_intake_summary.csv", toCsv(
      ["institution", "programme", "intake", "active", "utilisation", "status"],
      rows.map(r => [inst.name, r.p.name, r.p.intake, r.active, `${r.util}%`, r.status.text]),
    ));
    log("report.export", `${inst.name} · ${rows.length} programmes`);
    toast("Report downloaded.");
  };
  return (
    <section>
      <PageHead section="Institution portal" title="Reports" lead="Enrolment, category and data-quality summaries. The same wording as the screen." pdf="PDF 9.1 · section 9" />
      <div className="card">
        <div className="row between"><b>Intake summary · {inst.name}</b><div className="row"><button onClick={exportCsv}>Export CSV</button><button onClick={() => window.print()}>Print</button></div></div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="tbl">
            <thead><tr><th>Programme</th><th className="num">Intake</th><th className="num">Active</th><th>Utilisation</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.p.id}><td>{r.p.name}</td><td className="num">{r.p.intake}</td><td className="num">{r.active}</td><td>{r.util}%</td><td>{r.status.text}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Users({ inst }: { inst: Inst }) {
  const staff = DEMO_USERS.filter(u => u.institutionId === inst.id);
  return (
    <section>
      <PageHead section="Institution portal" title="Users and roles" lead="Staff accounts for this institution. Adding accounts is not part of this demo." pdf="PDF 9.1" />
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Can</th></tr></thead>
          <tbody>
            {staff.map(u => (
              <tr key={u.username}><td>{u.displayName}</td><td className="mono">{u.username}</td><td>{u.role}</td><td className="small">{u.hint}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">The system administrator manages accounts across institutions. Student records are never visible to that role.</p>
      <button className="ghost small" onClick={() => go("#/dashboard")}>Back to dashboard</button>
    </section>
  );
}

