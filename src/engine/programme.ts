// Lookups and derived numbers for programmes. Accepted uploads in the session add to active seats.
import { INSTITUTIONS, type Institution, type Programme } from "../data/seed";

export function findProgramme(progId: string): { inst: Institution; prog: Programme } | undefined {
  for (const inst of INSTITUTIONS) {
    const prog = inst.programmes.find(p => p.id === progId);
    if (prog) return { inst, prog };
  }
  return undefined;
}

// institution scope: a college sees its own; AICTE and regulators see all
export function scopedInstitutions(instId: string | undefined, all: boolean): Institution[] {
  if (all || !instId) return INSTITUTIONS;
  return INSTITUTIONS.filter(i => i.id === instId);
}

export function activeOf(p: Programme, delta: Record<string, number>): number {
  return p.active + (delta[p.id] ?? 0);
}

export function utilisation(active: number, intake: number): number {
  return intake === 0 ? 0 : Math.round((active / intake) * 100);
}

// plain-language status used on the national view; always shown with text, not colour alone
export function statusLabel(active: number, intake: number, breachDay: number | null): { text: string; tone: "ok" | "warn" | "flag" } {
  if (active > intake) return { text: "Over intake", tone: "flag" };
  if (breachDay !== null && breachDay <= 14) return { text: `Breach in ${breachDay} days`, tone: "flag" };
  if (utilisation(active, intake) >= 95) return { text: "Near intake", tone: "warn" };
  return { text: "Within intake", tone: "ok" };
}
