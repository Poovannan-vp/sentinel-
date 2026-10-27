// Plain CSV helpers: a small parser for the upload template, a messy sample file for the demo,
// and a writer for report and error-report exports.
import type { UploadRow } from "./upload";

export const TEMPLATE_HEADERS = ["apaar", "name", "category", "admission_date"];

export function parseCsv(text: string): UploadRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  return lines.slice(1).map((line, i) => {
    const cells = line.split(",").map(c => c.trim());
    const get = (name: string) => (idx(name) >= 0 ? cells[idx(name)] ?? "" : "");
    return {
      line: i + 2,                       // header is line 1
      apaar: get("apaar"),
      name: get("name"),
      category: get("category"),
      admissionDate: get("admission_date"),
    };
  });
}

// A messy but realistic file: lower-case category, a date in dd/mm/yyyy, a missing ID,
// a bad format, a duplicate, an unknown category, and more rows than seats left.
export const SAMPLE_CSV = [
  "apaar,name,category,admission_date",
  "AP10000101,Aarav Sharma,General,2026-07-02",
  "AP10000102,Diya Menon,OBC,2026-07-02",
  "AP10000103,Rohan Iyer,obc,2026-07-03",
  "AP10000104,Sneha Kulkarni,SC,03/07/2026",
  ",Kabir Singh,General,2026-07-04",
  "AP1000-0106,Meera Nair,ST,2026-07-04",
  "AP10000107,Ishaan Gupta,General,2026-07-05",
  "AP10000108,Anil Kumr,EWS,2026-07-05",
  "AP10000109,Tara Reddy,NRI,2026-07-06",
  "AP10000110,Yusuf Khan,General,2026-07-06",
  "AP10000111,Pooja Hegde,SC,2026-07-07",
  "AP10000102,Diya Menon,OBC,2026-07-07",
  "AP10000112,Neha Joshi,General,2026-07-08",
  "AP10000113,Vikram Rao,ST,2026-07-08",
  "AP10000114,Ananya Das,General,2026-07-09",
  "AP10000115,Farhan Ali,OCI,2026-07-09",
  "AP10000116,Priya Shetty,General,2026-07-10",
  "AP10000117,Karthik Bhat,Gen,2026-07-10",
  "AP10000118,Lakshmi Pillai,General,2026-07-11",
  "AP10000119,Rahul Verma,OBC,2026-07-11",
  "AP10000120,Sana Fathima,General,2026-07-12",
  "AP10000121,Mohit Jain,General,2026-07-12",
  "AP10000122,Ritu Agarwal,FN,2026-07-13",
].join("\n");

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers.map(cell).join(","), ...rows.map(r => r.map(cell).join(","))].join("\n");
}

// Browser download of a text file. Only runs on user action.
export function download(filename: string, text: string, type = "text/csv") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
