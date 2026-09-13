import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for integration secrets (the Google refresh token). The key is
 * a 32-byte base64 value in INTEGRATION_ENCRYPTION_KEY, held only in server
 * env — ciphertext in the database is useless without it.
 *
 * Wire format (base64): v1 . iv(12) . authTag(16) . ciphertext
 */

function encryptionKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be 32 bytes of base64");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith("v1.")) {
    throw new Error("Unrecognized secret ciphertext format");
  }
  const buf = Buffer.from(payload.slice(3), "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("Secret ciphertext too short");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
