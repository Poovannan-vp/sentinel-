import { useEffect, useState } from "react";
import { useStore } from "../store";
import { INSTITUTIONS, API_CLIENTS, RULE_SEED, DEMO_USERS, type Flag } from "../data/seed";
import { project } from "../engine/forecast";
import { ghostSeats, RULES } from "../engine/rules";
import { toCsv, download } from "../engine/csv";
import { AuditChain } from "../engine/audit";
import { PageHead, Metric, Chip, Empty } from "../components/ui";
import { type PageKey } from "../auth/roles";
import { activeMap, FlagDetail } from "./Institution";
import { AssistantBody } from "../assistant/Assistant";

// AICTE official and system administrator pages. AICTE sees every institution; no student record is opened here.
export function Aicte({ page, param }: { page: PageKey; param?: string }) {
  switch (page) {
    case "national": return <National />;
    case "heatmap": return <Heatmap />;
    case "institutions": return <Institutions />;
    case "flagqueue": return <FlagQueue />;
    case "flagdetail": return <FlagDetailPage id={param ?? ""} />;
    case "ghostdash": return <GhostDash />;
    case "query": return <QueryPage />;
    case "duplicates": return <Duplicates />;
    case "verlog": return <VerificationLog />;
    case "audit": return <AuditViewer />;
    case "rules": return <Rules />;
    case "reportsx": return <ReportsX />;
    case "admin": return <Admin />;
    default: return <Empty title="This page is not part of the AICTE portal." />;
  }
}

// Every programme across every institution, with the same status wording the college sees.
function useAllRows() {
  const { data } = useStore();
  return INSTITUTIONS.flatMap(i =>
    activeMap(i.programmes, data.deltas).map(r => ({ ...r, inst: i })),
  );
}

function National() {
  const { data } = useStore();
  const rows = useAllRows();
  const states = [...new Set(INSTITUTIONS.map(i => i.state))];
  const byState = states.map(state => {
    const insts = INSTITUTIONS.filter(i => i.state === state);
    const instIds = insts.map(i => i.id);
    const sub = rows.filter(r => instIds.includes(r.inst.id));
    return {
      state,
      institutions: insts.length,
      intake: sub.reduce((n, r) => n + r.p.intake, 0),
      active: sub.reduce((n, r) => n + r.active, 0),
      openFlags: data.flags.filter(f => f.state === "open" && instIds.includes(f.instId)).length,
    };
  });
  const totalIntake = rows.reduce((n, r) => n + r.p.intake, 0);
  const totalActive = rows.reduce((n, r) => n + r.active, 0);
  return (
    <section>
      <PageHead section="AICTE portal" title="National dashboard" lead="Admissions against approved intake across all institutions in the demo, by state." pdf="PDF 9.2" />
      <div className="grid g4">
        <Metric label="Institutions" value={INSTITUTIONS.length} note="In the demo set." />
        <Metric label="Approved intake" value={totalIntake} />
        <Metric label="Active enrolment" value={totalActive} note={`${Math.round((totalActive / totalIntake) * 100)}% of intake`} />
        <Metric label="Open flags" value={data.flags.filter(f => f.state === "open").length} note="Waiting for a decision." />
      </div>
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>State</th><th className="num">Institutions</th><th className="num">Intake</th><th className="num">Active</th><th className="num">Open flags</th></tr></thead>
          <tbody>
            {byState.map(s => (
              <tr key={s.state}><td>{s.state}</td><td className="num">{s.institutions}</td><td className="num">{s.intake}</td><td className="num">{s.active}</td><td className="num">{s.openFlags}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card table-wrap">
        <div className="label">Programmes needing attention</div>
        <table className="tbl">
          <thead><tr><th>Institution</th><th>Programme</th><th className="num">Intake</th><th className="num">Active</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.p.id}>
                <td>{r.inst.name}</td><td>{r.p.name}</td><td className="num">{r.p.intake}</td><td className="num">{r.active}</td>
                <td><Chip tone={r.status.tone}>{r.status.text}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Projected utilisation at +0, +7, +14 and +30 days, from the same pace projection the college sees.
function Heatmap() {
  const { data } = useStore();
  const rows = useAllRows();
  const days = [0, 7, 14, 30];
  const heat = (pct: number) => (pct >= 100 ? "#fde2e2" : pct >= 95 ? "#fff4d6" : pct >= 80 ? "#eef6e9" : "#f5f8fb");
  return (
    <section>
      <PageHead section="AICTE portal" title="Forecast heatmap" lead="Projected utilisation of approved intake at 0, 7, 14 and 30 days. Darker cells are closer to, or past, intake." pdf="PDF 9.2 · section 5" />
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>Institution</th><th>Programme</th><th className="num">Now</th>{days.slice(1).map(d => <th key={d} className="num">+{d} days</th>)}</tr></thead>
          <tbody>
            {rows.map(r => {
              const f = project(r.p.snapshots, r.p.intake);
              return (
                <tr key={r.p.id}>
                  <td className="small">{r.inst.name}</td>
                  <td>{r.p.name}</td>
                  {days.map(d => {
                    const pct = Math.round(((r.active + f.slope * d) / r.p.intake) * 100);
                    return <td key={d} className="num" style={{ background: heat(pct) }}>{pct}%</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted">Projection = active now plus the last-7-day pace. Shown as a percentage of approved intake. Colour is paired with the number.</p>
      <div className="small muted">Flags open across the set: {data.flags.filter(f => f.state === "open").length}</div>
    </section>
  );
}

// Institutions ranked by how soon their pace reaches intake.
function Institutions() {
  const rows = useAllRows();
  const [sel, setSel] = useState<string | null>(null);
  const ranked = INSTITUTIONS.map(i => {
    const sub = rows.filter(r => r.inst.id === i.id);
    const soonest = Math.min(...sub.map(r => r.breachDay ?? Infinity));
    return { inst: i, soonest, active: sub.reduce((n, r) => n + r.active, 0), intake: sub.reduce((n, r) => n + r.p.intake, 0) };
  }).sort((a, b) => a.soonest - b.soonest);
  const detail = sel ? rows.filter(r => r.inst.id === sel) : [];
  return (
    <section>
      <PageHead section="AICTE portal" title="Institution list and detail" lead="Ranked by how soon the pace reaches approved intake. Select an institution to see its programmes." pdf="PDF 9.2" />
      <div className="grid g2">
        <div className="card table-wrap">
          <table className="tbl">
            <thead><tr><th>Institution</th><th>State</th><th className="num">Active / intake</th><th>Soonest breach</th></tr></thead>
            <tbody>
              {ranked.map(r => (
                <tr key={r.inst.id} className={sel === r.inst.id ? "sel" : ""} onClick={() => setSel(r.inst.id)} style={{ cursor: "pointer" }}>
                  <td>{r.inst.name}</td>
                  <td className="small">{r.inst.state}</td>
                  <td className="num">{r.active} / {r.intake}</td>
                  <td>{Number.isFinite(r.soonest) ? <Chip tone={r.soonest <= 14 ? "flag" : "info"}>{r.soonest} days</Chip> : <span className="muted small">none</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          {!sel && <Empty title="Select an institution" next="Click a row on the left." />}
          {sel && (
            <>
              <div className="label">{INSTITUTIONS.find(i => i.id === sel)?.name}</div>
              <table className="tbl">
                <thead><tr><th>Programme</th><th className="num">Intake</th><th className="num">Active</th><th>Status</th></tr></thead>
                <tbody>
                  {detail.map(r => (
                    <tr key={r.p.id}><td>{r.p.name}</td><td className="num">{r.p.intake}</td><td className="num">{r.active}</td><td><Chip tone={r.status.tone}>{r.status.text}</Chip></td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function FlagQueue() {
  const { data } = useStore();
  const order = { open: 0, escalated: 1, dismissed: 2 } as const;
  const flags = [...data.flags].sort((a, b) => order[a.state] - order[b.state]);
  const instName = (id: string) => INSTITUTIONS.find(i => i.id === id)?.name ?? id;
  return (
    <section>
      <PageHead section="AICTE portal" title="Flag review queue" lead="Every flag across institutions. Open a flag to read the rule, the evidence and the history before deciding." pdf="PDF 9.2 · section 2 (Pillar B)" />
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>ID</th><th>Institution</th><th>Flag</th><th>Rule</th><th>Confidence</th><th>State</th></tr></thead>
          <tbody>
            {flags.map(f => (
              <tr key={f.id} onClick={() => { window.location.hash = `#/flagdetail/${f.id}`; }} style={{ cursor: "pointer" }}>
                <td className="mono"><a href={`#/flagdetail/${f.id}`}>{f.id}</a></td>
                <td className="small">{instName(f.instId)}</td>
                <td>{f.title}</td>
                <td className="mono small">{f.rule}</td>
                <td>{f.confidence}</td>
                <td><Chip tone={f.state === "open" ? "warn" : f.state === "escalated" ? "flag" : "neutral"}>{f.state}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Flag detail: read the evidence and history, then decide. A reason is required before any action.
function FlagDetailPage({ id }: { id: string }) {
  const { data, flagAction } = useStore();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"dismissed" | "escalated" | null>(null);
  const flag: Flag | undefined = data.flags.find(f => f.id === id);
  const inst = INSTITUTIONS.find(i => i.id === flag?.instId);

  if (!flag) {
    return (
      <section>
        <PageHead section="AICTE portal" title="Flag detail" lead="The flag you asked for is not in the queue." pdf="PDF 9.2 · section 2 (Pillar B)" />
        <Empty title={`No flag ${id || "(blank)"}.`} next="Go back to the flag review queue." />
      </section>
    );
  }

  // every audit entry that mentions this flag, oldest first
  const history = data.audit.filter(e => e.detail === flag.id || e.detail.startsWith(`${flag.id} `));
  const canAct = flag.state === "open";

  const confirm = () => {
    if (!pending || !reason.trim()) return;
    flagAction(flag.id, pending, reason.trim());
    setPending(null);
    setReason("");
  };

  return (
    <section>
      <PageHead section="AICTE portal" title={`Flag ${flag.id} · ${flag.title}`} lead={`${inst?.name ?? flag.instId}. Read the evidence, then dismiss or escalate with a reason.`} pdf="PDF 9.2 · section 2 (Pillar B)" />
      <div className="grid g2">
        <div className="card"><FlagDetail flag={flag} /></div>
        <div className="card stack">
          <div className="label">Decision</div>
          {!canAct && <div className="small muted">This flag is {flag.state}. Decisions are recorded in the audit log.</div>}
          {canAct && !pending && (
            <div className="row">
              <button onClick={() => setPending("dismissed")}>Dismiss flag</button>
              <button className="primary" onClick={() => setPending("escalated")}>Escalate to review</button>
            </div>
          )}
          {canAct && pending && (
            <>
              <label className="small">Reason (required)
                <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }} aria-label="Reason" />
              </label>
              <div className="row">
                <button className="primary" disabled={!reason.trim()} onClick={confirm}>
                  Confirm {pending === "dismissed" ? "dismiss" : "escalation"}
                </button>
                <button onClick={() => { setPending(null); setReason(""); }}>Cancel</button>
              </div>
            </>
          )}
          <div className="label" style={{ marginTop: 10 }}>History</div>
          {history.length === 0 && <div className="small muted">No history yet.</div>}
          {history.map(e => (
            <div key={e.n} className="small" style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
              <b>#{e.n}</b> · {e.at.replace("T", " ").slice(0, 16)} · {e.actor} · <span className="mono">{e.action}</span>
              <div className="muted">{e.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GhostDash() {
  const { data } = useStore();
  const rows = useAllRows();
  const per = INSTITUTIONS.map(i => {
    const sub = rows.filter(r => r.inst.id === i.id);
    return {
      inst: i,
      reported: sub.reduce((n, r) => n + r.p.reported, 0),
      active: sub.reduce((n, r) => n + r.active, 0),
      ghost: sub.reduce((n, r) => n + ghostSeats(r.p.reported, r.active), 0),
      gsFlags: data.flags.filter(f => f.instId === i.id && f.rule.startsWith("GS")).length,
    };
  });
  const total = per.reduce((n, r) => n + r.ghost, 0);
  return (
    <section>
      <PageHead section="AICTE portal" title="Ghost-seat dashboard" lead="Seats reported but without activity signals (fee, exam, attendance). Shown as unverified seats, not as fraud." pdf="PDF section 2 (Differentiator 1)" />
      <div className="grid g3">
        <Metric label="Unverified seats" value={total} note="Across all institutions." />
        <Metric label="Institutions with GS flags" value={per.filter(p => p.gsFlags > 0).length} />
        <Metric label="Rule" value="GS-01 v1.2" note="Enrolled seat with no activity signal over 30 days." />
      </div>
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>Institution</th><th className="num">Reported</th><th className="num">Active</th><th className="num">Unverified</th><th className="num">GS flags</th></tr></thead>
          <tbody>
            {per.map(p => (
              <tr key={p.inst.id}><td>{p.inst.name}</td><td className="num">{p.reported}</td><td className="num">{p.active}</td><td className="num">{p.ghost}</td><td className="num">{p.gsFlags}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QueryPage() {
  return (
    <section>
      <PageHead section="AICTE portal" title="Natural-language query" lead="Ask in plain English. Each question runs one approved, read-only template; no free-form database access." pdf="PDF section 2 (Differentiator 2)" />
      <AssistantBody scope="aicte" />
    </section>
  );
}

function Duplicates() {
  const { data, clearDuplicate } = useStore();
  const instName = (id: string) => INSTITUTIONS.find(i => i.id === id)?.name ?? id;
  return (
    <section>
      <PageHead section="AICTE portal" title="Duplicate candidates" lead="Matches on a hashed student key only. No APAAR ID or name is shown here." pdf="PDF 9.2 · rule DUP-01" />
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>Hashed key</th><th>Institutions</th><th>State</th><th></th></tr></thead>
          <tbody>
            {data.duplicates.map(d => (
              <tr key={d.ref}>
                <td className="mono">{d.ref}</td>
                <td className="small">{d.instIds.map(instName).join(" · ")}</td>
                <td>{d.state === "open" ? <Chip tone="warn">open</Chip> : <Chip tone="ok">cleared</Chip>}</td>
                <td>{d.state === "open" && <button onClick={() => clearDuplicate(d.ref)}>Mark as different students</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.duplicates.length === 0 && <Empty title="No duplicate candidates." />}
    </section>
  );
}

function VerificationLog() {
  const { data } = useStore();
  return (
    <section>
      <PageHead section="AICTE portal" title="Verification log" lead="Every signed yes or no answer. The student's record is never included, only the claim and the purpose." pdf="PDF 9.2 · section 8" />
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>Credential</th><th>Requester</th><th>Claim</th><th>Purpose</th><th>Issued</th><th>Consent</th></tr></thead>
          <tbody>
            {data.creds.map(c => {
              const consent = data.consents.find(x => x.id === c.consentId);
              return (
                <tr key={c.id}>
                  <td className="mono">{c.id}</td>
                  <td>{c.requester}</td>
                  <td className="small">{c.claimText}</td>
                  <td className="small">{c.purpose}</td>
                  <td className="small">{c.issuedAt}</td>
                  <td>{consent?.status === "revoked" ? <Chip tone="flag">revoked</Chip> : <Chip tone="ok">granted</Chip>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.creds.length === 0 && <Empty title="No verifications yet." next="A verifier can request one claim from the Request verification page." />}
    </section>
  );
}

// Live chain check on the real log, plus a tamper demo on a copy so the real log is never changed.
function AuditViewer() {
  const { data } = useStore();
  const [broken, setBroken] = useState<number | null>(null);
  const [tamper, setTamper] = useState<{ at: number; found: number } | null>(null);

  useEffect(() => {
    const chain = new AuditChain();
    chain.entries = data.audit;
    chain.verify().then(setBroken);
  }, [data.audit]);

  const runTamper = async () => {
    if (data.audit.length < 2) return;
    const copy = new AuditChain();
    copy.entries = data.audit.map(e => ({ ...e }));
    const at = 1;
    copy.entries[at] = { ...copy.entries[at], detail: `${copy.entries[at].detail} (edited)` };
    const found = await copy.verify();
    setTamper({ at: at + 1, found: found + 1 });
  };

  const intact = broken === -1;
  return (
    <section>
      <PageHead section="AICTE portal" title="Audit log viewer" lead="Every sign-in, decision, upload and verification, chained so that any edit is detected." pdf="PDF 9.2 · section 11" />
      <div className="grid g3">
        <Metric label="Entries" value={data.audit.length} />
        <Metric label="Chain check" value={broken === null ? "checking" : intact ? "intact" : `broken at #${broken + 1}`} note="Recomputed in the browser." />
        <div className="card stack">
          <div className="label">Tamper demo</div>
          <div className="small muted">Edits entry #2 in a copy and runs the check again.</div>
          <div><button onClick={runTamper} disabled={data.audit.length < 2}>Run tamper demo</button></div>
          {tamper && <div className="small">Copy: entry #{tamper.at} changed. Chain breaks at #{tamper.found}.</div>}
        </div>
      </div>
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th className="num">#</th><th>Time</th><th>Actor</th><th>Action</th><th>Detail</th><th>Hash</th></tr></thead>
          <tbody>
            {data.audit.slice(-40).reverse().map(e => (
              <tr key={e.n}>
                <td className="num">{e.n}</td>
                <td className="small">{e.at.replace("T", " ").slice(0, 19)}</td>
                <td className="small">{e.actor}</td>
                <td className="mono small">{e.action}</td>
                <td className="small">{e.detail}</td>
                <td className="mono small">{e.hash.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Rules() {
  return (
    <section>
      <PageHead section="AICTE portal" title="Rules and thresholds" lead="Each rule has a version. A flag always shows the version it was raised under." pdf="PDF 9.2 · section 4" />
      <div className="card table-wrap">
        <div className="label">Rules in force</div>
        <table className="tbl">
          <thead><tr><th>Code</th><th>Version</th><th>What it checks</th><th>Threshold</th><th>Active</th></tr></thead>
          <tbody>
            {RULE_SEED.map(r => (
              <tr key={r.code}><td className="mono">{r.code}</td><td>{r.version}</td><td>{r.description}</td><td>{r.threshold}</td><td>{r.active ? <Chip tone="ok">on</Chip> : <Chip tone="neutral">off</Chip>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card table-wrap">
        <div className="label">Upload validation codes</div>
        <table className="tbl">
          <thead><tr><th>Code</th><th>Version</th><th>Meaning</th></tr></thead>
          <tbody>
            {Object.values(RULES).map(r => (
              <tr key={r.code}><td className="mono">{r.code}</td><td>{r.version}</td><td>{r.label}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportsX() {
  const { log, toast } = useStore();
  const rows = useAllRows();
  const exportAll = () => {
    download("national_intake_summary.csv", toCsv(
      ["institution", "state", "programme", "intake", "active", "utilisation", "status"],
      rows.map(r => [r.inst.name, r.inst.state, r.p.name, r.p.intake, r.active, `${r.util}%`, r.status.text]),
    ));
    log("report.export", `national · ${rows.length} programmes`);
    toast("National summary downloaded.");
  };
  return (
    <section>
      <PageHead section="AICTE portal" title="Reports and exports" lead="The same figures as the national dashboard, as a file for the record." pdf="PDF 9.2 · section 9" />
      <div className="card">
        <div className="row between">
          <b>National intake summary</b>
          <div className="row"><button className="primary" onClick={exportAll}>Export CSV</button><button onClick={() => window.print()}>Print</button></div>
        </div>
        <p className="small muted">{rows.length} programmes across {INSTITUTIONS.length} institutions.</p>
      </div>
    </section>
  );
}

// Administration: accounts, API clients, and the demo reset. Student records are not reachable from this role.
function Admin() {
  const { resetDemo, data } = useStore();
  return (
    <section>
      <PageHead section="System administration" title="Administration" lead="Accounts, API clients and the demo reset. Student records are not available to this role." pdf="PDF 9.2 · section 10" />
      <div className="grid g3">
        <Metric label="Accounts" value={DEMO_USERS.length} note="Demo accounts only." />
        <Metric label="API clients" value={API_CLIENTS.length} />
        <Metric label="Audit entries" value={data.audit.length} />
      </div>
      <div className="card table-wrap">
        <div className="label">Accounts</div>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Institution</th></tr></thead>
          <tbody>
            {DEMO_USERS.map(u => (
              <tr key={u.username}><td>{u.displayName}</td><td className="mono">{u.username}</td><td>{u.role}</td><td className="small">{u.institutionId ?? "all"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card table-wrap">
        <div className="label">API clients</div>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Institution</th><th>Scopes</th><th>Rate limit</th><th>Status</th></tr></thead>
          <tbody>
            {API_CLIENTS.map(c => (
              <tr key={c.name}><td>{c.name}</td><td className="small">{c.institution}</td><td className="mono small">{c.scopes}</td><td className="small">{c.rateLimit}</td><td><Chip tone="ok">{c.status}</Chip></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card row between">
        <div className="small"><b>Reset demo data</b><div className="muted">Restores the starting state from the JSON files and clears the saved cache.</div></div>
        <button onClick={resetDemo}>Reset demo data</button>
      </div>
    </section>
  );
}
