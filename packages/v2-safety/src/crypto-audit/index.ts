/**
 * Cryptographic Audit Signing
 *
 * Signs audit entries with HMAC-SHA256 so tampering is detectable.
 * Agent has INSERT but cannot forge valid signatures.
 */

import { createHmac } from "node:crypto";

export interface SignedResult {
  signature: string;
  algorithm: "HMAC-SHA256";
}

function serialize(entry: Record<string, unknown>): string {
  return JSON.stringify(entry, Object.keys(entry).sort());
}

export function signEntry(entry: Record<string, unknown>, secretKey: string): SignedResult {
  const hmac = createHmac("sha256", secretKey);
  hmac.update(serialize(entry));
  return {
    signature: hmac.digest("hex"),
    algorithm: "HMAC-SHA256",
  };
}

export function verifyEntry(entry: Record<string, unknown>, signature: string, secretKey: string): boolean {
  const computed = signEntry(entry, secretKey);
  return computed.signature === signature;
}
