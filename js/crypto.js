import { ACCESS } from "./config.js";

const enc = new TextEncoder();

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function normalizeCode(code) {
  return String(code || "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Leitet aus dem Zugangscode zwei Werte ab (PBKDF2, langsam mit Absicht):
 *  - verifier: wird mit dem gespeicherten Prüfwert verglichen
 *  - familyId: geheimer Ordnername der Familien-Daten in der Datenbank
 */
export async function deriveFromCode(code) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("insecure-context");
  }
  const key = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(ACCESS.salt), iterations: ACCESS.iterations, hash: "SHA-256" },
      key,
      512
    )
  );
  return {
    verifier: toHex(bits.slice(0, 32)),
    familyId: toBase64Url(bits.slice(32)),
  };
}
