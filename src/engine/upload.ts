// Row-by-row validation for a college upload. Partial acceptance: valid rows are kept,
// the rest are explained and can be fixed and resubmitted. Nothing is dropped silently.
import { CATEGORIES } from "../data/seed";
import { checkRow, statusFor, RULES, type RuleCode, type RowStatus } from "./rules";

export type UploadRow = {
  line: number;
  apaar: string;
  name: string;
  category: string;
  admissionDate: string;
};

export type RowResult = {
  row: UploadRow;
  status: RowStatus;
  failed: RuleCode[];
  reasons: string[];
};

export function validateUpload(rows: UploadRow[], remainingIntake: number): RowResult[] {
  const seen = new Set<string>();
  let accepted = 0;

  return rows.map(row => {
    const failed: RuleCode[] = checkRow(
      { apaar: row.apaar || null, name: row.name, category: row.category || null },
      seen,
    );
    const reasons: string[] = failed.map(code => RULES[code].label);

    // category: exact match is fine; a different case is correctable; anything else is unknown
    if (row.category && !failed.includes("CATEGORY")) {
      const exact = CATEGORIES.find(c => c === row.category);
      const loose = CATEGORIES.find(c => c.toLowerCase() === row.category.toLowerCase());
      if (!exact && loose) {
        failed.push("CATEGORY_CASE");
        reasons.push(`${RULES.CATEGORY_CASE.label}: use "${loose}"`);
      } else if (!loose) {
        failed.push("CATEGORY");
        reasons.push(`${RULES.CATEGORY.label}: "${row.category}"`);
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.admissionDate)) {
      failed.push("DATE_FORMAT");
      reasons.push(`${RULES.DATE_FORMAT.label}: "${row.admissionDate || "empty"}"`);
    }

    // intake check runs last, on rows that are otherwise valid
    if (statusFor(failed) === "accepted") {
      if (accepted >= remainingIntake) {
        failed.push("INTAKE_EXCESS");
        reasons.push(RULES.INTAKE_EXCESS.label);
      } else {
        accepted++;
      }
    }

    return { row, status: statusFor(failed), failed, reasons };
  });
}

export function summarise(results: RowResult[]) {
  const out = { rows: results.length, accepted: 0, correctable: 0, review: 0 };
  for (const r of results) out[r.status]++;
  return out;
}
