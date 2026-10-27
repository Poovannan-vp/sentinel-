// Sentinel Assistant templates. Each question maps to one fixed, read-only template over the seed
// data and the live store. No free-form query runs; an unmatched question gets a refusal and the
// nearest supported question. This keeps answers repeatable and easy to explain on screen.
import { INSTITUTIONS, ROSTER, type Institution, type Programme } from "../data/seed";
import { activeOf, utilisation } from "../engine/programme";
import { project } from "../engine/forecast";
import { ghostSeats } from "../engine/rules";
import type { Persisted } from "../store";

export type Scope = "aicte" | "college";
export type Ctx = { data: Persisted; scope: Scope; instId: string | null };
export type Answer = { text: string; headers?: string[]; rows?: (string | number)[][] };
export type Template = {
  id: string;
  example: string;
  words: string[];
  scopes: Scope[];
  run: (ctx: Ctx) => Answer;
};

// institutions and programmes the question may cover: all for AICTE, the own one for a college
function scopedProgrammes(ctx: Ctx): { inst: Institution; p: Programme; active: number }[] {
  return INSTITUTIONS.filter(i => ctx.scope === "aicte" || i.id === ctx.instId)
    .flatMap(inst => inst.programmes.map(p => ({ inst, p, active: activeOf(p, ctx.data.deltas) })));
}

function inScope(ctx: Ctx, instId: string): boolean {
  return ctx.scope === "aicte" || instId === ctx.instId;
}

export const TEMPLATES: Template[] = [
  {
    id: "intake-utilisation",
    example: "Which programmes are at or near intake?",
    words: ["intake", "near", "full", "over", "utilisation", "utilization", "seats", "capacity"],
    scopes: ["aicte", "college"],
    run: ctx => {
      const rows = scopedProgrammes(ctx)
        .map(r => ({ ...r, util: utilisation(r.active, r.p.intake) }))
        .filter(r => r.util >= 95)
        .sort((a, b) => b.util - a.util);
      if (rows.length === 0) return { text: "No programme is at 95% of approved intake or more." };
      return {
        text: `${rows.length} programme${rows.length === 1 ? " is" : "s are"} at 95% of approved intake or more.`,
        headers: ["Programme", "Institution", "Active", "Intake", "Utilisation"],
        rows: rows.map(r => [r.p.name, r.inst.name, r.active, r.p.intake, `${r.util}%`]),
      };
    },
  },
  {
    id: "breach-timing",
    example: "When will admissions reach intake?",
    words: ["breach", "reach", "when", "soonest", "pace", "days", "date", "forecast", "projected"],
    scopes: ["aicte", "college"],
    run: ctx => {
      const rows = scopedProgrammes(ctx)
        .map(r => ({ ...r, f: project(r.p.snapshots, r.p.intake) }))
        .filter(r => r.f.breachDay !== null)
        .sort((a, b) => (a.f.breachDay ?? 0) - (b.f.breachDay ?? 0));
      if (rows.length === 0) return { text: "No programme is on pace to reach approved intake in the forecast window." };
      const first = rows[0];
      return {
        text: `${first.p.name} is on pace to reach intake in about ${first.f.breachDay} days.`,
        headers: ["Programme", "Institution", "Days (earliest–latest)"],
        rows: rows.map(r => [r.p.name, r.inst.name, r.f.breachRange ? `${r.f.breachRange[0]}–${r.f.breachRange[1]}` : `${r.f.breachDay}`]),
      };
    },
  },
  {
    id: "ghost-seats",
    example: "How many seats have no activity signal?",
    words: ["ghost", "unverified", "activity", "signal", "fee", "empty", "unused"],
    scopes: ["aicte", "college"],
    run: ctx => {
      const per = INSTITUTIONS.filter(i => inScope(ctx, i.id)).map(i => {
        const sub = scopedProgrammes({ ...ctx, scope: "aicte" }).filter(r => r.inst.id === i.id);
        return { inst: i, reported: sub.reduce((n, r) => n + r.p.reported, 0), active: sub.reduce((n, r) => n + r.active, 0) };
      });
      const total = per.reduce((n, r) => n + ghostSeats(r.reported, r.active), 0);
      return {
        text: `${total} seats are unverified: reported, but with no fee, exam or attendance signal. Shown as unverified, not as fraud.`,
        headers: ["Institution", "Reported", "Active", "Unverified"],
        rows: per.map(r => [r.inst.name, r.reported, r.active, ghostSeats(r.reported, r.active)]),
      };
    },
  },
  {
    id: "open-flags",
    example: "Which flags are still open?",
    words: ["flag", "flags", "open", "raised", "rule", "pending", "decision", "waiting"],
    scopes: ["aicte", "college"],
    run: ctx => {
      const flags = ctx.data.flags.filter(f => f.state === "open" && inScope(ctx, f.instId));
      const name = (id: string) => INSTITUTIONS.find(i => i.id === id)?.name ?? id;
      return {
        text: `${flags.length} flag${flags.length === 1 ? " is" : "s are"} open.`,
        headers: ["Flag", "Institution", "Title", "Rule"],
        rows: flags.map(f => [f.id, name(f.instId), f.title, f.rule]),
      };
    },
  },
  {
    id: "category-mix",
    example: "What is the admission category mix?",
    words: ["category", "categories", "nri", "sc", "st", "obc", "ews", "oci", "general", "mix", "share", "quota"],
    scopes: ["aicte", "college"],
    run: ctx => {
      const rows = ROSTER.filter(r => r.status === "active" && inScope(ctx, r.instId));
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
      const total = rows.length || 1;
      const table = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      return {
        text: `${rows.length} active students in the roster. Shares are of that total.`,
        headers: ["Category", "Students", "Share"],
        rows: table.map(([c, n]) => [c, n, `${Math.round((n / total) * 100)}%`]),
      };
    },
  },
  {
    id: "duplicates-open",
    example: "Are there duplicate candidates waiting?",
    words: ["duplicate", "duplicates", "same", "twice", "match", "dup", "candidate"],
    scopes: ["aicte"],
    run: ctx => {
      const open = ctx.data.duplicates.filter(d => d.state === "open");
      return {
        text: `${open.length} duplicate candidate${open.length === 1 ? " is" : "s are"} open. Matches use a hashed key only.`,
        headers: ["Hashed key", "Institutions"],
        rows: open.map(d => [d.ref, d.instIds.join(" · ")]),
      };
    },
  },
  {
    id: "verifications",
    example: "How many verifications were signed?",
    words: ["verification", "verifications", "verify", "verifier", "claim", "signed", "requested", "employer"],
    scopes: ["aicte"],
    run: ctx => {
      const creds = ctx.data.creds;
      return {
        text: `${creds.length} verification${creds.length === 1 ? " has" : "s have"} been signed. Each records a yes or no answer and the purpose, never the record.`,
        headers: ["Credential", "Requester", "Purpose", "Issued"],
        rows: creds.map(c => [c.id, c.requester, c.purpose, c.issuedAt]),
      };
    },
  },
  {
    id: "upload-results",
    example: "What happened in the latest uploads?",
    words: ["upload", "uploads", "batch", "file", "accepted", "correctable", "review", "rows", "latest"],
    scopes: ["aicte", "college"],
    run: ctx => {
      const ups = ctx.data.uploads.filter(u => inScope(ctx, u.instId)).slice(0, 5);
      if (ups.length === 0) return { text: "No uploads yet for this scope." };
      return {
        text: `Latest ${ups.length} upload${ups.length === 1 ? "" : "s"}. Rows are accepted, correctable or sent to review; none are dropped silently.`,
        headers: ["Upload", "File", "Accepted", "Correctable", "Review"],
        rows: ups.map(u => [u.id, u.file, u.accepted, u.correctable, u.review]),
      };
    },
  },
];

const REFUSE_PATTERN = /\b(select|drop|delete|insert|update|sql|schema|password|token)\b/i;

// Pure matcher: returns the template that scores best for this scope, or a refusal with the nearest question.
export function answerFor(question: string, ctx: Ctx): { templateId: string | null; answer: Answer; nearest: string | null } {
  const q = question.toLowerCase();
  const allowed = TEMPLATES.filter(t => t.scopes.includes(ctx.scope));
  if (REFUSE_PATTERN.test(q)) {
    return {
      templateId: null,
      answer: { text: "Free-form database queries are not supported. Ask one of the approved questions." },
      nearest: allowed[0].example,
    };
  }
  // whole words only, so "sc" does not match "describe"
  const tokens = new Set(q.split(/[^a-z]+/));
  let best: Template | null = null;
  let bestScore = 0;
  for (const t of allowed) {
    const score = t.words.filter(w => tokens.has(w)).length;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  if (best) return { templateId: best.id, answer: best.run(ctx), nearest: null };
  return {
    templateId: null,
    answer: { text: "I can't answer that from the approved templates." },
    nearest: allowed[0].example,
  };
}
