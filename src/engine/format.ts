// Display helpers. Raw APAAR IDs are masked on screen; matching uses a keyed reference instead.

// AP10428841 -> AP••••••41
export function maskApaar(id: string): string {
  if (!id) return "—";
  if (id.length <= 4) return "••••";
  return id.slice(0, 2) + "•".repeat(Math.max(0, id.length - 4)) + id.slice(-2);
}

// Keyed-looking reference for cross-institution matching (demo only; not a real HMAC).
export function keyedRef(id: string): string {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  return "kh_" + h.toString(16).padStart(8, "0");
}

// "1,20,000" style for rupee amounts
export function inr(n: number): string {
  return "₹ " + n.toLocaleString("en-IN");
}

export function pct(n: number, d: number): string {
  return d === 0 ? "—" : Math.round((n / d) * 100) + "%";
}
