// Synthetic upload rows for the engine tests and the "large batch" check. Seeded, so every run is the same.
import { CATEGORIES, rng, type SyntheticRow } from "../data/seed";

export function generateRows(count: number, seed = 2026): SyntheticRow[] {
  const rand = rng(seed);
  const rows: SyntheticRow[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const r = rand();
    let apaar: string | null = "AP" + String(10000000 + Math.floor(rand() * 89999999)).padStart(8, "0");
    if (r < 0.01) apaar = null;                  // missing ID
    else if (r < 0.015) apaar = "AP-" + i;        // bad format
    else if (r < 0.018 && i > 0) apaar = rows[Math.floor(rand() * i)].apaar; // duplicate
    const category = rand() < 0.02 ? null : CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
    rows[i] = { apaar, name: "Student " + i, category };
  }
  return rows;
}
