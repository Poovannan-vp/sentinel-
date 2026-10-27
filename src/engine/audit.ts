// Hash-chained audit log: each entry stores the hash of the previous one.
// Changing any past entry breaks every hash after it, and verify() reports where.

export type AuditEntry = {
  n: number;
  at: string;
  actor: string;
  action: string;
  detail: string;
  prevHash: string;
  hash: string;
};

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

const GENESIS = "0".repeat(64);

export class AuditChain {
  entries: AuditEntry[] = [];

  async append(actor: string, action: string, detail: string, at = new Date().toISOString()): Promise<AuditEntry> {
    const prevHash = this.entries.length ? this.entries[this.entries.length - 1].hash : GENESIS;
    const n = this.entries.length + 1;
    const hash = await sha256Hex([prevHash, n, at, actor, action, detail].join("|"));
    const entry = { n, at, actor, action, detail, prevHash, hash };
    this.entries.push(entry);
    return entry;
  }

  // returns the index of the first broken entry, or -1 if the chain is intact
  async verify(): Promise<number> {
    let prev = GENESIS;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const expected = await sha256Hex([prev, e.n, e.at, e.actor, e.action, e.detail].join("|"));
      if (e.prevHash !== prev || e.hash !== expected) return i;
      prev = e.hash;
    }
    return -1;
  }
}
