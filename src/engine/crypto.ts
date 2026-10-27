// Ed25519 signing for verifiable claims. WebCrypto first; @noble/ed25519 if the browser lacks Ed25519.
import * as ed from "@noble/ed25519";

export type Signer = {
  kind: "webcrypto" | "noble";
  publicKey: Uint8Array | CryptoKey;
  sign(message: Uint8Array): Promise<Uint8Array>;
  verify(message: Uint8Array, signature: Uint8Array): Promise<boolean>;
};

export async function createSigner(): Promise<Signer> {
  try {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" } as any, true, ["sign", "verify"]);
    const { publicKey, privateKey } = pair as CryptoKeyPair;
    return {
      kind: "webcrypto",
      publicKey,
      async sign(m) {
        return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" } as any, privateKey, m as BufferSource));
      },
      async verify(m, s) {
        return crypto.subtle.verify({ name: "Ed25519" } as any, publicKey, s as BufferSource, m as BufferSource);
      },
    };
  } catch {
    const priv = ed.utils.randomPrivateKey();
    const pub = await ed.getPublicKeyAsync(priv);
    return {
      kind: "noble",
      publicKey: pub,
      async sign(m) { return ed.signAsync(m, priv); },
      async verify(m, s) { return ed.verifyAsync(s, m, pub); },
    };
  }
}

export type Claim = {
  id: string;
  student: string;        // keyed reference, never the APAAR ID itself
  claim: string;          // e.g. "holds a B.Tech in CSE from an approved institution"
  purpose: string;
  issuer: string;
  issuedAt: string;       // ISO time
  result: "yes";
};

// canonical JSON (sorted keys) so the signature is stable
export function canonical(c: Claim): Uint8Array {
  const keys = Object.keys(c).sort() as (keyof Claim)[];
  const obj: Record<string, string> = {};
  for (const k of keys) obj[k] = c[k];
  return new TextEncoder().encode(JSON.stringify(obj));
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach(b => (s += String.fromCharCode(b)));
  return btoa(s);
}

export type Credential = { claim: Claim; signature: string };

// revocation list; the public scan page checks this before it says VALID
export const revoked = new Set<string>();

export async function issue(signer: Signer, claim: Claim): Promise<Credential> {
  const sig = await signer.sign(canonical(claim));
  return { claim, signature: toBase64(sig) };
}

export async function checkCredential(signer: Signer, cred: Credential): Promise<"VALID" | "REVOKED" | "INVALID"> {
  if (revoked.has(cred.claim.id)) return "REVOKED";
  const sig = Uint8Array.from(atob(cred.signature), c => c.charCodeAt(0));
  const ok = await signer.verify(canonical(cred.claim), sig);
  return ok ? "VALID" : "INVALID";
}
