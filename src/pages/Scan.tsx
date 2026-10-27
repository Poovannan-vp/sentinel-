import { useEffect, useState } from "react";
import { useStore } from "../store";
import { Chip } from "../components/ui";

type Status = "VALID" | "REVOKED" | "NOT FOUND" | "INVALID";

// Public check opened from a QR code. No sign-in. Shows the claim, the issuer, the status and nothing else.
export function ScanPage({ id }: { id: string }) {
  const { data, scanCredential, signerReady } = useStore();
  const [status, setStatus] = useState<Status | null>(null);
  const rec = data.creds.find(c => c.id === id);

  useEffect(() => {
    if (!signerReady) return;
    scanCredential(id).then(setStatus);
  }, [id, signerReady, scanCredential]);

  const tone = status === "VALID" ? "ok" : status === "REVOKED" ? "flag" : status === "INVALID" ? "flag" : "warn";
  const message: Record<Status, string> = {
    VALID: "The issuer's signature checks out and the student has not stopped access.",
    REVOKED: "The student has stopped access to this check. Do not rely on it.",
    INVALID: "The signature does not match. Do not rely on this credential.",
    "NOT FOUND": "No credential with this reference exists in this demo.",
  };

  return (
    <div className="scan-wrap">
      <div className="card scan-card">
        <div className="eyebrow">APAAR Sentinel · public check</div>
        <h1 style={{ marginTop: 4 }}>Credential check</h1>
        <div className="mono small muted">{id || "(no reference)"}</div>
        <div style={{ margin: "16px 0" }}>
          {status === null && <Chip tone="neutral">checking</Chip>}
          {status && <Chip tone={tone}>{status}</Chip>}
        </div>
        {status && <p>{message[status]}</p>}
        {rec && (
          <dl className="kv">
            <dt>Claim</dt><dd>{rec.claimText}</dd>
            <dt>Answer</dt><dd>{rec.signed.claim.result === "yes" ? "Yes" : "No"}</dd>
            <dt>Issuer</dt><dd>{rec.signed.claim.issuer}</dd>
            <dt>Issued</dt><dd>{rec.issuedAt}</dd>
          </dl>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>Only the claim, the issuer, the validity and the revocation status are shown. No name, APAAR ID or record is included.</p>
      </div>
    </div>
  );
}
