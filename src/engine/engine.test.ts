import { describe, it, expect, beforeEach } from "vitest";
import { checkRow, statusFor, ghostSeats } from "./rules";
import { project } from "./forecast";
import { createSigner, issue, checkCredential, revoked, type Claim } from "./crypto";
import { AuditChain } from "./audit";
import { INSTITUTIONS } from "../data/seed";
import { generateRows } from "./synthetic";
import { validateUpload } from "./upload";
import { parseCsv, toCsv, SAMPLE_CSV } from "./csv";
import { pageAllowed } from "../auth/roles";

// the demo's first programme (B.Tech CSE): intake 100, 120 reported, 96 active
const PROGRAMME = INSTITUTIONS[0].programmes[0];
const SNAPSHOTS = PROGRAMME.snapshots;

describe("rules", () => {
  it("accepts a clean row", () => {
    const failed = checkRow({ apaar: "AP12345678", name: "A", category: "OBC" }, new Set());
    expect(failed).toEqual([]);
    expect(statusFor(failed)).toBe("accepted");
  });

  it("flags a missing ID as correctable", () => {
    const failed = checkRow({ apaar: null, name: "B", category: "SC" }, new Set());
    expect(failed).toEqual(["MISSING_ID"]);
    expect(statusFor(failed)).toBe("correctable");
  });

  it("flags a duplicate within the upload for review", () => {
    const seen = new Set<string>();
    checkRow({ apaar: "AP12345678", name: "C", category: "General" }, seen);
    const failed = checkRow({ apaar: "AP12345678", name: "D", category: "General" }, seen);
    expect(failed).toEqual(["DUPLICATE"]);
    expect(statusFor(failed)).toBe("review");
  });

  it("computes ghost seats from reported and active", () => {
    expect(ghostSeats(PROGRAMME.reported, PROGRAMME.active)).toBe(24);
  });
});

describe("forecast", () => {
  it("projects a breach from the recent pace", () => {
    const f = project(SNAPSHOTS, PROGRAMME.intake);
    expect(f.breachDay).not.toBeNull();
    expect(f.breachDay!).toBeGreaterThanOrEqual(8);
    expect(f.breachDay!).toBeLessThanOrEqual(10);
    expect(f.breachRange![0]).toBeLessThanOrEqual(f.breachRange![1]);
  });

  it("returns null when the pace never reaches intake", () => {
    const f = project([10, 10, 10, 10, 10, 10, 10], 100);
    expect(f.breachDay).toBeNull();
  });
});

describe("credentials", () => {
  const claim: Claim = {
    id: "CRED-1",
    student: "ref-7f3a",
    claim: "holds a B.Tech in CSE from an approved institution",
    purpose: "employment check",
    issuer: "AICTE (simulated)",
    issuedAt: "2026-10-26T10:00:00Z",
    result: "yes",
  };

  beforeEach(() => revoked.clear());

  it("verifies a valid credential", async () => {
    const signer = await createSigner();
    const cred = await issue(signer, claim);
    expect(await checkCredential(signer, cred)).toBe("VALID");
  });

  it("rejects a tampered payload", async () => {
    const signer = await createSigner();
    const cred = await issue(signer, claim);
    const tampered = { ...cred, claim: { ...claim, claim: "holds a PhD" } };
    expect(await checkCredential(signer, tampered)).toBe("INVALID");
  });

  it("reports a revoked credential", async () => {
    const signer = await createSigner();
    const cred = await issue(signer, claim);
    revoked.add(claim.id);
    expect(await checkCredential(signer, cred)).toBe("REVOKED");
  });
});

describe("audit chain", () => {
  it("is intact after appends", async () => {
    const chain = new AuditChain();
    await chain.append("officer", "flag.dismiss", "GS-01 · reason: data entry lag");
    await chain.append("officer", "flag.escalate", "BR-02 · escalated to review");
    expect(await chain.verify()).toBe(-1);
  });

  it("detects a changed entry", async () => {
    const chain = new AuditChain();
    await chain.append("officer", "flag.dismiss", "GS-01");
    await chain.append("officer", "flag.escalate", "BR-02");
    chain.entries[0].detail = "GS-01 edited";
    expect(await chain.verify()).toBe(0);
  });
});

describe("upload validation", () => {
  const row = (apaar: string, category: string, admissionDate = "2026-07-02") => ({
    line: 2, apaar, name: "X", category, admissionDate,
  });

  it("keeps valid rows and stops at the seats left", () => {
    const rows = [row("AP10000001", "General"), row("AP10000002", "OBC"), row("AP10000003", "SC")];
    const out = validateUpload(rows, 2);
    expect(out.map(r => r.status)).toEqual(["accepted", "accepted", "review"]);
    expect(out[2].failed).toContain("INTAKE_EXCESS");
  });

  it("marks a wrong-case category as correctable with the right spelling", () => {
    const [r] = validateUpload([row("AP10000004", "obc")], 10);
    expect(r.status).toBe("correctable");
    expect(r.reasons.join(" ")).toContain('use "OBC"');
  });

  it("asks for YYYY-MM-DD dates", () => {
    const [r] = validateUpload([row("AP10000005", "General", "03/07/2026")], 10);
    expect(r.failed).toContain("DATE_FORMAT");
  });
});

describe("csv", () => {
  it("parses the template columns in any order", () => {
    const rows = parseCsv("name,apaar,admission_date,category\nA,AP10000009,2026-07-02,SC");
    expect(rows[0]).toMatchObject({ apaar: "AP10000009", category: "SC", admissionDate: "2026-07-02", line: 2 });
  });

  it("writes quoted cells when a value has a comma", () => {
    expect(toCsv(["a", "b"], [["x,y", 2]])).toBe('a,b\n"x,y",2');
  });

  it("sample file has rows to check", () => {
    expect(parseCsv(SAMPLE_CSV).length).toBeGreaterThan(20);
  });
});

describe("permissions", () => {
  it("keeps student records away from the system administrator", () => {
    expect(pageAllowed("sysadmin", "records")).toBe(false);
    expect(pageAllowed("sysadmin", "admin")).toBe(true);
  });

  it("lets only AICTE officers open the flag decision page", () => {
    expect(pageAllowed("aicte", "flagdetail")).toBe(true);
    expect(pageAllowed("college", "flagdetail")).toBe(false);
    expect(pageAllowed("verifier", "flagdetail")).toBe(false);
  });

  it("opens the AICTE dashboard only to roles that can see flags", () => {
    expect(pageAllowed("college", "dashboard")).toBe(true);
    expect(pageAllowed("verifier", "dashboard")).toBe(false);
  });
});

describe("synthetic upload", () => {
  it("creates the requested number of rows", () => {
    expect(generateRows(1000).length).toBe(1000);
  });

  it("gives the same outcome on every run (seeded)", () => {
    const a = generateRows(5000, 7);
    const b = generateRows(5000, 7);
    expect(a).toEqual(b);
  });

  it("classifies most rows as accepted, with some errors and review cases", () => {
    const rows = generateRows(100000);
    const seen = new Set<string>();
    const counts = { accepted: 0, correctable: 0, review: 0 };
    for (const r of rows) counts[statusFor(checkRow(r, seen))]++;
    expect(counts.accepted / rows.length).toBeGreaterThan(0.9);
    expect(counts.correctable).toBeGreaterThan(0);
    expect(counts.review).toBeGreaterThan(0);
    expect(counts.accepted + counts.correctable + counts.review).toBe(rows.length);
  });
});
