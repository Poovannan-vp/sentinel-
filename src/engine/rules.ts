import type { SyntheticRow } from "../data/seed";

// Each rule carries a version so an explanation stays correct after rules change.
export const RULES = {
  MISSING_ID: { code: "MISSING_ID", version: "1.0", label: "APAAR ID missing" },
  FORMAT: { code: "FORMAT", version: "1.0", label: "APAAR ID format invalid" },
  DUPLICATE: { code: "DUPLICATE", version: "1.1", label: "Duplicate within upload" },
  CATEGORY: { code: "CATEGORY", version: "1.0", label: "Admission category missing or unknown" },
  CATEGORY_CASE: { code: "CATEGORY_CASE", version: "1.0", label: "Category written in the wrong case" },
  DATE_FORMAT: { code: "DATE_FORMAT", version: "1.0", label: "Date not in YYYY-MM-DD" },
  INTAKE_EXCESS: { code: "INTAKE_EXCESS", version: "1.0", label: "Admission beyond approved intake" },
} as const;

export type RuleCode = keyof typeof RULES;
export type RowStatus = "accepted" | "correctable" | "review";

const APAAR_FORMAT = /^AP\d{8}$/;

// Returns the rule codes a row fails for ID and category presence. Empty array = clean row.
export function checkRow(row: SyntheticRow, seen: Set<string>): RuleCode[] {
  const failed: RuleCode[] = [];
  if (!row.apaar) failed.push("MISSING_ID");
  else if (!APAAR_FORMAT.test(row.apaar)) failed.push("FORMAT");
  else if (seen.has(row.apaar)) failed.push("DUPLICATE");
  if (row.apaar && APAAR_FORMAT.test(row.apaar)) seen.add(row.apaar);
  if (!row.category) failed.push("CATEGORY");
  return failed;
}

// Duplicates and intake excess need human review; format and missing fields are correctable.
export function statusFor(failed: RuleCode[]): RowStatus {
  if (failed.length === 0) return "accepted";
  if (failed.includes("DUPLICATE") || failed.includes("INTAKE_EXCESS")) return "review";
  return "correctable";
}

// Ghost-seat rule GS-01 v1.2: reported seats with no activity signals.
export const GHOST_RULE = { code: "GS-01", version: "1.2" } as const;
export function ghostSeats(reported: number, active: number): number {
  return Math.max(0, reported - active);
}
