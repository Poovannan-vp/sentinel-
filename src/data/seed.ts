// Typed view over the JSON files in this folder. The JSON is the source of truth; this file only
// declares the shapes and checks them at startup, so a bad edit fails loudly instead of mid-demo.
import instData from "./institutions.json";
import recData from "./records.json";
import userData from "./users.json";

export type Programme = {
  id: string;
  name: string;
  intake: number;
  reported: number;
  active: number;
  supernumerary: number;
  nri: number;
  oci: number;
  fn: number;
  snapshots: number[];
};

export type Institution = {
  id: string;
  name: string;
  state: string;
  type: "Non-PGDM" | "PGDM";
  lastSyncedMinutes: number;
  programmes: Programme[];
};

export type FlagState = "open" | "dismissed" | "escalated";
export type Note = { author: string; at: string; text: string };
export type Flag = {
  id: string;
  instId: string;
  progId: string;
  rule: string;
  title: string;
  evidence: string;
  days: number;
  missingSignals: string[];
  confidence: "High" | "Medium" | "Low";
  state: FlagState;
  reason: string;
  notes: Note[];
};

export type Duplicate = { ref: string; instIds: string[]; state: "open" | "cleared" };

export type Upload = {
  id: string;
  instId: string;
  file: string;
  at: string;
  rows: number;
  accepted: number;
  correctable: number;
  review: number;
};

export type Consent = {
  id: string;
  studentRef: string;
  requester: string;
  purpose: string;
  claim: string;
  at: string;
  status: "granted" | "revoked";
};

export type Student = {
  ref: string;
  name: string;
  apaar: string;
  studentId: string;
  instId: string;
  progId: string;
  category: string;
  admissionDate: string;
  status: string;
  programme: string;
  institution: string;
  year: string;
};

export type RoleKey = "college" | "aicte" | "student" | "verifier" | "sysadmin";

export type DemoUser = {
  username: string;
  passwordSha256: string;
  role: RoleKey;
  displayName: string;
  institutionId: string | null;
  studentRef?: string;
  hint: string;
};

export const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS", "NRI", "OCI", "FN"] as const;

export const INSTITUTIONS: Institution[] = instData.institutions as Institution[];
export const STUDENT: Student = recData.student as Student;
export const FLAG_SEED: Flag[] = recData.flags as Flag[];
export const DUPLICATE_SEED: Duplicate[] = recData.duplicates as Duplicate[];
export const UPLOAD_SEED: Upload[] = recData.uploads as Upload[];
export const CONSENT_SEED: Consent[] = recData.consents as Consent[];
export type RosterRow = {
  name: string;
  apaar: string;
  instId: string;
  progId: string;
  category: string;
  admissionDate: string;
  status: string;
};
export const ROSTER: RosterRow[] = recData.roster as RosterRow[];
export const RULE_SEED = recData.rules;
export const API_CLIENTS = recData.apiClients;
export const DEMO_USERS: DemoUser[] = userData.users as DemoUser[];
export const OTP_DEMO_CODE: string = userData.otpDemoCode;

// Startup check: every programme must have a positive intake and a snapshot series.
export function checkSeed(): string[] {
  const problems: string[] = [];
  for (const i of INSTITUTIONS) {
    for (const p of i.programmes) {
      if (p.intake <= 0) problems.push(`${p.id}: intake must be positive`);
      if (p.snapshots.length === 0) problems.push(`${p.id}: no snapshots`);
    }
  }
  if (!DEMO_USERS.length) problems.push("users.json has no accounts");
  return problems;
}

// mulberry32: small seeded RNG so every run shows the same numbers
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SyntheticRow = {
  apaar: string | null;
  name: string;
  category: string | null;
};
