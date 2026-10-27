// App state. The JSON files are the starting point; every change is saved to localStorage,
// so a reload keeps the demo state. "Reset demo data" clears the saved copy.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AuditChain, type AuditEntry } from "./engine/audit";
import { canonical, issue, type Claim, type Credential as Signed, type Signer } from "./engine/crypto";
import { demoSigner } from "./engine/signer";
import { keyedRef } from "./engine/format";
import { CONSENT_SEED, DUPLICATE_SEED, FLAG_SEED, STUDENT, UPLOAD_SEED, type Consent, type Duplicate, type DemoUser, type Flag, type Upload } from "./data/seed";
import { loadSession, saveSession, toSession, type Session } from "./auth/session";

export type CredentialRecord = {
  id: string;
  consentId: string;
  studentRef: string;
  claimText: string;
  requester: string;
  purpose: string;
  issuedAt: string;
  signed: Signed;
};

export type CorrectionRequest = { id: string; at: string; text: string; studentRef: string; state: "sent" | "in review" };

export type Persisted = {
  flags: Flag[];
  consents: Consent[];
  uploads: Upload[];
  duplicates: Duplicate[];
  deltas: Record<string, number>;
  creds: CredentialRecord[];
  corrections: CorrectionRequest[];
  audit: AuditEntry[];
};

export type Toast = { id: number; text: string; undo?: () => void };

type Store = {
  session: Session | null;
  signIn: (user: DemoUser) => void;
  signOut: () => void;
  data: Persisted;
  signerReady: boolean;
  log: (action: string, detail: string) => void;
  flagAction: (id: string, state: "dismissed" | "escalated", reason: string) => void;
  addNote: (flagId: string, text: string) => void;
  setConsent: (id: string, status: Consent["status"]) => void;
  requestClaim: (claimText: string, purpose: string, requester: string) => Promise<CredentialRecord | null>;
  scanCredential: (id: string) => Promise<"VALID" | "REVOKED" | "NOT FOUND" | "INVALID">;
  submitUpload: (u: Omit<Upload, "id" | "at"> & { progId: string }) => void;
  sendCorrection: (text: string) => void;
  clearDuplicate: (ref: string) => void;
  resetDemo: () => void;
  toasts: Toast[];
  toast: (text: string, undo?: () => void) => void;
  dismissToast: (id: number) => void;
};

const DATA_KEY = "sentinel.data.v1";
const Ctx = createContext<Store | null>(null);

function nowStr(): string {
  return new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function seedData(): Persisted {
  return {
    flags: structuredClone(FLAG_SEED),
    consents: structuredClone(CONSENT_SEED),
    uploads: structuredClone(UPLOAD_SEED),
    duplicates: structuredClone(DUPLICATE_SEED),
    deltas: {},
    creds: [],
    corrections: [],
    audit: [],
  };
}

function loadData(): Persisted {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Persisted;
      if (Array.isArray(d.flags) && Array.isArray(d.audit)) return d;
    }
  } catch {
    // corrupt cache: fall back to the JSON seed
  }
  return seedData();
}

// Appends one entry to a copy of the chain and returns the new entries.
async function appendEntry(entries: AuditEntry[], actor: string, action: string, detail: string): Promise<AuditEntry[]> {
  const c = new AuditChain();
  c.entries = [...entries];
  await c.append(actor, action, detail);
  return c.entries;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [data, setData] = useState<Persisted>(() => loadData());
  const [signerReady, setSignerReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const signerRef = useRef<Signer | null>(null);
  const latest = useRef({ data, session });
  latest.current = { data, session };
  // audit appends run one at a time so no entry is lost or reordered
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    demoSigner().then(s => {
      signerRef.current = s;
      setSignerReady(true);
    });
  }, []);

  // first run: write a short history so the audit page is not empty when recorded
  useEffect(() => {
    if (latest.current.data.audit.length === 0) {
      const seedEvents: [string, string][] = [
        ["demo.start", "synthetic data loaded"],
        ["upload.submit", "dit_ece_batch_2026-07.csv · 84 accepted"],
        ["flag.raised", "F-2 · breach projected · B.Tech CSE"],
      ];
      queue.current = queue.current.then(async () => {
        let entries: AuditEntry[] = [];
        for (const [action, detail] of seedEvents) {
          entries = await appendEntry(entries, "system", action, detail);
        }
        setData(d => (d.audit.length ? d : { ...d, audit: entries }));
      });
    }
  }, []);

  const log = useCallback((action: string, detail: string) => {
    const actor = latest.current.session?.displayName ?? "anonymous";
    queue.current = queue.current.then(async () => {
      const next = await appendEntry(latest.current.data.audit, actor, action, detail);
      setData(d => ({ ...d, audit: next }));
    });
  }, []);

  const update = useCallback((fn: (d: Persisted) => Persisted) => setData(d => fn(d)), []);

  const signIn = useCallback((user: DemoUser) => {
    const s = toSession(user);
    saveSession(s);
    setSession(s);
    latest.current.session = s;
    log("auth.login", `${user.username} · ${user.role}`);
  }, [log]);

  const signOut = useCallback(() => {
    log("auth.logout", latest.current.session?.username ?? "");
    saveSession(null);
    setSession(null);
  }, [log]);

  const toast = useCallback((text: string, undo?: () => void) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, undo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  const flagAction = useCallback((id: string, state: "dismissed" | "escalated", reason: string) => {
    const prev = latest.current.data.flags.find(f => f.id === id)?.state ?? "open";
    update(d => ({ ...d, flags: d.flags.map(f => (f.id === id ? { ...f, state, reason } : f)) }));
    log(state === "dismissed" ? "flag.dismissed" : "flag.escalated", `${id} · ${reason}`);
    toast(state === "dismissed" ? `Flag ${id} dismissed.` : `Flag ${id} escalated to AICTE review.`, () => {
      update(d => ({ ...d, flags: d.flags.map(f => (f.id === id ? { ...f, state: prev, reason: "" } : f)) }));
      log("flag.undo", id);
    });
  }, [update, log, toast]);

  const addNote = useCallback((flagId: string, text: string) => {
    const author = latest.current.session?.displayName ?? "Reviewer";
    update(d => ({
      ...d,
      flags: d.flags.map(f => (f.id === flagId ? { ...f, notes: [...f.notes, { author, at: nowStr(), text }] } : f)),
    }));
    log("flag.note", `${flagId} · ${text.slice(0, 80)}`);
  }, [update, log]);

  const setConsent = useCallback((id: string, status: Consent["status"]) => {
    const prev = latest.current.data.consents.find(c => c.id === id)?.status ?? "granted";
    update(d => ({ ...d, consents: d.consents.map(c => (c.id === id ? { ...c, status } : c)) }));
    log(status === "revoked" ? "consent.revoked" : "consent.restored", id);
    toast(status === "revoked" ? "Access stopped. Credentials from this request now fail." : "Access restored.", () => {
      update(d => ({ ...d, consents: d.consents.map(c => (c.id === id ? { ...c, status: prev } : c)) }));
      log("consent.undo", id);
    });
  }, [update, log, toast]);

  const requestClaim = useCallback(async (claimText: string, purpose: string, requester: string): Promise<CredentialRecord | null> => {
    const signer = signerRef.current;
    if (!signer) return null;
    const n = latest.current.data.consents.length + 1;
    const consentId = `REQ-${900 + n}`;
    const at = nowStr();
    const claim: Claim = {
      id: `CR-${3000 + latest.current.data.creds.length + 1}`,
      student: keyedRef(STUDENT.apaar),
      claim: claimText,
      purpose,
      issuer: "AICTE",
      issuedAt: new Date().toISOString(),
      result: "yes",
    };
    const signed = await issue(signer, claim);
    const rec: CredentialRecord = {
      id: claim.id, consentId, studentRef: STUDENT.ref, claimText, requester, purpose, issuedAt: at, signed,
    };
    update(d => ({
      ...d,
      consents: [...d.consents, { id: consentId, studentRef: STUDENT.ref, requester, purpose, claim: claimText, at, status: "granted" }],
      creds: [...d.creds, rec],
    }));
    log("verification.signed", `${claim.id} · ${requester} · purpose: ${purpose}`);
    return rec;
  }, [update, log]);

  const scanCredential = useCallback(async (id: string) => {
    const rec = latest.current.data.creds.find(c => c.id === id);
    if (!rec) {
      log("scan.not_found", id);
      return "NOT FOUND" as const;
    }
    const consent = latest.current.data.consents.find(c => c.id === rec.consentId);
    if (consent?.status === "revoked") {
      log("scan.revoked", id);
      return "REVOKED" as const;
    }
    const signer = signerRef.current;
    if (!signer) return "INVALID" as const;
    const sig = Uint8Array.from(atob(rec.signed.signature), c => c.charCodeAt(0));
    const ok = await signer.verify(canonical(rec.signed.claim), sig);
    log("scan.valid", `${id} · ${ok ? "signature ok" : "signature failed"}`);
    return ok ? ("VALID" as const) : ("INVALID" as const);
  }, [log]);

  const submitUpload = useCallback((u: Omit<Upload, "id" | "at"> & { progId: string }) => {
    const count = latest.current.data.uploads.length + 1;
    const id = `UP-${2700 + count}`;
    const { progId, ...rest } = u;
    const row: Upload = { id, at: nowStr(), ...rest };
    update(d => ({
      ...d,
      uploads: [row, ...d.uploads],
      deltas: { ...d.deltas, [progId]: (d.deltas[progId] ?? 0) + u.accepted },
    }));
    log("upload.submit", `${id} · ${u.file} · ${u.accepted} accepted, ${u.correctable} correctable, ${u.review} review`);
  }, [update, log]);

  const sendCorrection = useCallback((text: string) => {
    const n = latest.current.data.corrections.length + 1;
    update(d => ({
      ...d,
      corrections: [{ id: `CORR-${100 + n}`, at: nowStr(), text, studentRef: STUDENT.ref, state: "sent" }, ...d.corrections],
    }));
    log("correction.requested", `${STUDENT.studentId} · ${text.slice(0, 80)}`);
    toast("Correction request sent to your institution.");
  }, [update, log, toast]);

  const clearDuplicate = useCallback((ref: string) => {
    update(d => ({ ...d, duplicates: d.duplicates.map(x => (x.ref === ref ? { ...x, state: "cleared" } : x)) }));
    log("duplicate.cleared", ref);
  }, [update, log]);

  const resetDemo = useCallback(() => {
    localStorage.removeItem(DATA_KEY);
    const fresh = seedData();
    setData(fresh);
    queue.current = queue.current.then(async () => {
      const entries = await appendEntry([], "system", "demo.reset", "demo data restored to the starting state");
      setData(d => ({ ...d, audit: entries }));
    });
    toast("Demo data reset to the starting state.");
  }, [toast]);

  const value = useMemo<Store>(() => ({
    session, signIn, signOut, data, signerReady, log, flagAction, addNote, setConsent,
    requestClaim, scanCredential, submitUpload, sendCorrection, clearDuplicate, resetDemo,
    toasts, toast, dismissToast,
  }), [session, data, signerReady, toasts, signIn, signOut, log, flagAction, addNote, setConsent, requestClaim, scanCredential, submitUpload, sendCorrection, clearDuplicate, resetDemo, toast, dismissToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
