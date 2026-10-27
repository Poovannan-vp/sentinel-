// Demo issuer key. The 32-byte Ed25519 seed is kept in localStorage so credentials issued
// before a reload still verify after it. A real issuer keeps the key in an HSM, never in a browser.
import * as ed from "@noble/ed25519";
import type { Signer } from "./crypto";

const KEY = "sentinel.issuer-key.v1";

function toHex(b: Uint8Array): string {
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}
function fromHex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function demoSigner(): Promise<Signer> {
  let seedHex = localStorage.getItem(KEY);
  if (!seedHex || seedHex.length !== 64) {
    seedHex = toHex(ed.utils.randomPrivateKey());
    localStorage.setItem(KEY, seedHex);
  }
  const priv = fromHex(seedHex);
  const pub = await ed.getPublicKeyAsync(priv);
  return {
    kind: "noble",
    publicKey: pub,
    sign: m => ed.signAsync(m, priv),
    verify: (m, s) => ed.verifyAsync(s, m, pub),
  };
}
