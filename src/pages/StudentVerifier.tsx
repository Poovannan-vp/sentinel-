import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useStore, type CredentialRecord } from "../store";
import { STUDENT, CONSENT_SEED, INSTITUTIONS } from "../data/seed";
import { maskApaar } from "../engine/format";
import { PageHead, Metric, Chip, Empty } from "../components/ui";
import { type PageKey } from "../auth/roles";

// Verifier request form: the claims an employer or bank may ask, with a stated purpose.
const CLAIMS = [
  "holds a B.Tech in Computer Science from an approved institution",
  "graduate of an approved institution",
  "enrolled in an approved programme",
];
const PURPOSES = ["Employment background check", "Account opening", "Admission check"];

// Student pages. Only the signed-in student's own data is shown.
export function StudentPages({ page }: { page: PageKey }) {
  switch (page) {
    case "myrecord": return <MyRecord />;
    case "consent": return <Consent />;
    case "correction": return <Correction />;
    case "credential": return <Credential />;
    default: return <Empty title="This page is not part of the student portal." />;
  }
}

// Verifier pages. A verifier gets a signed yes or no for one claim, never the record.
export function VerifierPages({ page }: { page: PageKey }) {
  switch (page) {
    case "request": return <RequestClaim />;
    case "result": return <Result />;
    case "history": return <History />;
    default: return <Empty title="This page is not part of the verifier portal." />;
  }
}

function MyRecord() {
  const inst = INSTITUTIONS.find(i => i.id === STUDENT.instId);
  return (
    <section>
      <PageHead section="Student portal" title="My record" lead="Your record as held by your institution. You can see it here and ask for a correction." pdf="PDF 9.3" />
      <div className="grid g2">
        <div className="card">
          <dl className="kv">
            <dt>Name</dt><dd>{STUDENT.name}</dd>
            <dt>APAAR ID</dt><dd className="mono">{maskApaar(STUDENT.apaar)}</dd>
            <dt>Student ID</dt><dd className="mono">{STUDENT.studentId}</dd>
            <dt>Institution</dt><dd>{inst?.name ?? STUDENT.institution}</dd>
            <dt>Programme</dt><dd>{STUDENT.programme}</dd>
            <dt>Academic year</dt><dd>{STUDENT.year}</dd>
            <dt>Admission date</dt><dd>{STUDENT.admissionDate}</dd>
            <dt>Category</dt><dd>{STUDENT.category}</dd>
            <dt>Status</dt><dd><Chip tone="ok">{STUDENT.status}</Chip></dd>
          </dl>
        </div>
        <div className="card stack">
          <div className="label">Something wrong?</div>
          <p className="small" style={{ margin: 0 }}>Send a correction request to your institution. It goes to the college inbox and is logged.</p>
          <div className="row"><a className="btn" href="#/correction">Request a correction</a></div>
        </div>
      </div>
    </section>
  );
}

// Consent: every request that has read a claim about this student. Access can be stopped and restored.
function Consent() {
  const { data, setConsent } = useStore();
  const mine = data.consents.filter(c => c.studentRef === STUDENT.ref);
  const isNew = (id: string) => !CONSENT_SEED.some(s => s.id === id);
  return (
    <section>
      <PageHead section="Student portal" title="Consent dashboard" lead="Who verified what about you, when, and why. You can stop access at any time; credentials from a stopped request then fail." pdf="PDF 9.3 · DPDP Act 2023" />
      <div className="card small muted">Under the Digital Personal Data Protection Act 2023, you may withdraw consent. Withdrawing stops future checks; it does not reverse checks already made.</div>
      <div className="stack">
        {mine.length === 0 && <Empty title="No requests yet." next="A verifier request about you will appear here." />}
        {mine.map(c => (
          <div key={c.id} className="card row between">
            <div className="stack" style={{ gap: 4 }}>
              <div><b>{c.requester}</b> {isNew(c.id) && <Chip tone="info">New request</Chip>}</div>
              <div className="small">Purpose: {c.purpose}</div>
              <div className="small muted">Claim: {c.claim} · {c.at}</div>
            </div>
            <div className="row">
              {c.status === "granted"
                ? <><Chip tone="ok">access on</Chip><button onClick={() => setConsent(c.id, "revoked")}>Stop access</button></>
                : <><Chip tone="flag">access stopped</Chip><button onClick={() => setConsent(c.id, "granted")}>Restore access</button></>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Correction() {
  const { data, sendCorrection } = useStore();
  const [text, setText] = useState("");
  const mine = data.corrections.filter(c => c.studentRef === STUDENT.ref);
  return (
    <section>
      <PageHead section="Student portal" title="Correction request" lead="Tell your institution what is wrong. The request is logged and goes to the college inbox." pdf="PDF 9.3" />
      <div className="grid g2">
        <div className="card stack">
          <label className="small">What needs correcting
            <textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="For example: my category should read OBC, not General." style={{ display: "block", width: "100%", marginTop: 4 }} aria-label="Correction" />
          </label>
          <div className="row">
            <button className="primary" disabled={!text.trim()} onClick={() => { sendCorrection(text.trim()); setText(""); }}>Send request</button>
          </div>
        </div>
        <div className="card">
          <div className="label">Your requests</div>
          {mine.length === 0 && <Empty title="No requests yet." />}
          {mine.map(c => (
            <div key={c.id} className="small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <b>{c.id}</b> · {c.at} · <Chip tone="info">{c.state}</Chip>
              <div>{c.text}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Credential: the signed claim with a QR code. Scanning the QR opens the public check, which shows only the claim and its status.
function Credential() {
  const { data, signerReady } = useStore();
  const creds = data.creds.filter(c => c.studentRef === STUDENT.ref);
  const latest = creds[creds.length - 1];
  return (
    <section>
      <PageHead section="Student portal" title="My credential" lead="A signed, revocable proof of one claim. It does not contain your full record." pdf="PDF 9.3 · section 8" />
      {!latest && (
        <Empty title="No credential issued yet." next="Ask for one from the Request verification page (as a verifier), or see the demo script." />
      )}
      {latest && <CredentialCard rec={latest} ready={signerReady} />}
    </section>
  );
}

export function CredentialCard({ rec, ready }: { rec: CredentialRecord; ready: boolean }) {
  const { data } = useStore();
  const [qr, setQr] = useState<string>("");
  const consent = data.consents.find(c => c.id === rec.consentId);
  const url = `${window.location.origin}${window.location.pathname}#/scan/${rec.id}`;

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 220 }).then(d => { if (alive) setQr(d); });
    return () => { alive = false; };
  }, [url]);

  return (
    <div className="grid g2">
      <div className="card stack">
        <div className="row between"><b>{rec.id}</b>{consent?.status === "revoked" ? <Chip tone="flag">access stopped</Chip> : <Chip tone="ok">active</Chip>}</div>
        <div>{rec.claimText}</div>
        <dl className="kv">
          <dt>Issuer</dt><dd>{rec.signed.claim.issuer}</dd>
          <dt>Requested by</dt><dd>{rec.requester}</dd>
          <dt>Purpose</dt><dd>{rec.purpose}</dd>
          <dt>Issued</dt><dd>{rec.issuedAt}</dd>
          <dt>Answer</dt><dd>{rec.signed.claim.result === "yes" ? "Yes" : "No"}</dd>
          <dt>Signature</dt><dd className="mono small">{ready ? `${rec.signed.signature.slice(0, 24)}…` : "signing key loading"}</dd>
        </dl>
      </div>
      <div className="card stack" style={{ alignItems: "center" }}>
        {qr ? <img src={qr} alt={`QR code for ${rec.id}`} width={220} height={220} /> : <div className="small muted">Creating QR code…</div>}
        <div className="small muted">Scan to check the claim. No name or record is shown on the check page.</div>
        <a href={`#/scan/${rec.id}`} className="small">Open the public check page</a>
      </div>
    </div>
  );
}

function RequestClaim() {
  const { requestClaim, signerReady, toast } = useStore();
  const [claim, setClaim] = useState(CLAIMS[0]);
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [requester, setRequester] = useState("Ramesh Industries HR");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const rec = await requestClaim(claim, purpose, requester);
    setBusy(false);
    if (rec) {
      toast(`Signed ${rec.id}: yes. See the result page.`);
      window.location.hash = "#/result";
    }
  };
  return (
    <section>
      <PageHead section="Verifier portal" title="Request verification" lead="Ask one claim, with a purpose. The answer is a signed yes or no; the student's record is not shared." pdf="PDF 9.3 · section 8" />
      <div className="grid g2">
        <div className="card stack">
          <label className="small">Claim
            <select value={claim} onChange={e => setClaim(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }}>
              {CLAIMS.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="small">Purpose
            <select value={purpose} onChange={e => setPurpose(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }}>
              {PURPOSES.map(p => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="small">Requester
            <input value={requester} onChange={e => setRequester(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }} />
          </label>
          <div className="row">
            <button className="primary" disabled={!signerReady || busy || !requester.trim()} onClick={submit}>
              {busy ? "Signing…" : "Request and sign"}
            </button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>The request creates a consent record the student can see and stop. The student must be the one in the demo ({maskApaar(STUDENT.apaar)}).</p>
        </div>
        <div className="card small">
          <div className="label">What you get back</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>A signed yes or no for this one claim</li>
            <li>The purpose and time of the request</li>
            <li>A status that changes if the student stops access</li>
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>You do not get the APAAR ID, the address, the marks or the full record.</p>
        </div>
      </div>
    </section>
  );
}

function Result() {
  const { data, signerReady } = useStore();
  const latest = data.creds[data.creds.length - 1];
  return (
    <section>
      <PageHead section="Verifier portal" title="Result" lead="The most recent signed answer. Its status follows the student's consent." pdf="PDF 9.3 · section 8" />
      {!latest && <Empty title="No result yet." next="Request a verification first." />}
      {latest && <CredentialCard rec={latest} ready={signerReady} />}
    </section>
  );
}

function History() {
  const { data } = useStore();
  const creds = [...data.creds].reverse();
  const revoked = creds.filter(c => data.consents.find(x => x.id === c.consentId)?.status === "revoked").length;
  return (
    <section>
      <PageHead section="Verifier portal" title="Request history" lead="Every verification you have requested, with its current status." pdf="PDF 9.3" />
      <div className="grid g3">
        <Metric label="Requests" value={creds.length} />
        <Metric label="Stopped by student" value={revoked} />
        <Metric label="Active" value={creds.length - revoked} />
      </div>
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>Credential</th><th>Claim</th><th>Purpose</th><th>Issued</th><th>Status</th></tr></thead>
          <tbody>
            {creds.map(c => {
              const stopped = data.consents.find(x => x.id === c.consentId)?.status === "revoked";
              return (
                <tr key={c.id}>
                  <td className="mono">{c.id}</td>
                  <td className="small">{c.claimText}</td>
                  <td className="small">{c.purpose}</td>
                  <td className="small">{c.issuedAt}</td>
                  <td>{stopped ? <Chip tone="flag">stopped</Chip> : <Chip tone="ok">active</Chip>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {creds.length === 0 && <Empty title="No requests yet." />}
    </section>
  );
}
