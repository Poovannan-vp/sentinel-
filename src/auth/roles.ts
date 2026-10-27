// Pages, portals and which role may open each one. Labels follow the PDF's section 9 wording.
// Access is checked here on every route change. In production the same rules run on the server.
import type { RoleKey } from "../data/seed";

export type PageKey =
  | "dashboard" | "programmes" | "upload" | "records" | "forecast" | "flags" | "ghost" | "reports" | "users"
  | "national" | "heatmap" | "institutions" | "flagqueue" | "flagdetail" | "ghostdash" | "query" | "duplicates" | "verlog" | "audit" | "rules" | "reportsx"
  | "admin"
  | "myrecord" | "consent" | "correction" | "credential"
  | "request" | "result" | "history"
  | "scan";

export type PageInfo = { label: string; section: string; hidden?: boolean };

export const PAGES: Record<PageKey, PageInfo> = {
  dashboard: { label: "Dashboard", section: "Institution portal" },
  programmes: { label: "Programmes and intake", section: "Institution portal" },
  upload: { label: "Upload center", section: "Institution portal" },
  records: { label: "Student records", section: "Institution portal" },
  forecast: { label: "Admission forecast", section: "Institution portal" },
  flags: { label: "Flags inbox", section: "Institution portal" },
  ghost: { label: "Ghost-seat review", section: "Institution portal" },
  reports: { label: "Reports", section: "Institution portal" },
  users: { label: "Users and roles", section: "Institution portal" },

  national: { label: "National dashboard", section: "AICTE portal" },
  heatmap: { label: "Forecast heatmap", section: "AICTE portal" },
  institutions: { label: "Institution list and detail", section: "AICTE portal" },
  flagqueue: { label: "Flag review queue", section: "AICTE portal" },
  flagdetail: { label: "Flag detail", section: "AICTE portal", hidden: true },
  ghostdash: { label: "Ghost-seat dashboard", section: "AICTE portal" },
  query: { label: "Natural-language query", section: "AICTE portal" },
  duplicates: { label: "Duplicate candidates", section: "AICTE portal" },
  verlog: { label: "Verification log", section: "AICTE portal" },
  audit: { label: "Audit log viewer", section: "AICTE portal" },
  rules: { label: "Rules and thresholds", section: "AICTE portal" },
  reportsx: { label: "Reports and exports", section: "AICTE portal" },

  admin: { label: "Administration", section: "System administration" },

  myrecord: { label: "My record", section: "Student" },
  consent: { label: "Consent dashboard", section: "Student" },
  correction: { label: "Correction request", section: "Student" },
  credential: { label: "My credential", section: "Student" },

  request: { label: "Request verification", section: "Verifier" },
  result: { label: "Result", section: "Verifier" },
  history: { label: "Request history", section: "Verifier" },

  scan: { label: "Scan result", section: "Public" },
};

export const ROLE_PAGES: Record<RoleKey, PageKey[]> = {
  college: ["dashboard", "programmes", "upload", "records", "forecast", "flags", "ghost", "reports", "users"],
  aicte: ["national", "heatmap", "institutions", "flagqueue", "flagdetail", "ghostdash", "query", "duplicates", "verlog", "audit", "rules", "reportsx"],
  student: ["myrecord", "consent", "correction", "credential"],
  verifier: ["request", "result", "history"],
  sysadmin: ["admin", "rules", "audit"],
};

export const ROLE_LABEL: Record<RoleKey, string> = {
  college: "College administrator",
  aicte: "AICTE official",
  student: "Student",
  verifier: "Verifier (employer)",
  sysadmin: "System administrator",
};

export const LANDING: Record<RoleKey, PageKey> = {
  college: "dashboard",
  aicte: "national",
  student: "myrecord",
  verifier: "request",
  sysadmin: "admin",
};

export function pageAllowed(role: RoleKey, page: PageKey): boolean {
  return ROLE_PAGES[role].includes(page);
}

// sidebar entries for a role, grouped by section, hidden pages left out
export function navFor(role: RoleKey): { section: string; items: PageKey[] }[] {
  const groups: { section: string; items: PageKey[] }[] = [];
  for (const key of ROLE_PAGES[role]) {
    const info = PAGES[key];
    if (info.hidden) continue;
    const g = groups.find(x => x.section === info.section);
    if (g) g.items.push(key);
    else groups.push({ section: info.section, items: [key] });
  }
  return groups;
}

export function isPageKey(s: string): s is PageKey {
  return s in PAGES;
}
