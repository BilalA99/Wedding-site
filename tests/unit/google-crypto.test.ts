import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { decryptSecret, encryptSecret } from "@/lib/google/crypto";

describe("integration secret crypto", () => {
  const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  afterEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
  });

  it("round-trips a refresh token", () => {
    const secret = "1//0abc-refresh-token-value_XYZ";
    const ciphertext = encryptSecret(secret);
    expect(ciphertext.startsWith("v1.")).toBe(true);
    expect(ciphertext).not.toContain(secret);
    expect(decryptSecret(ciphertext)).toBe(secret);
  });

  it("produces distinct ciphertexts for the same plaintext (fresh IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects tampered ciphertext", () => {
    const ciphertext = encryptSecret("secret");
    const buf = Buffer.from(ciphertext.slice(3), "base64");
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff;
    expect(() => decryptSecret(`v1.${buf.toString("base64")}`)).toThrow();
  });

  it("rejects ciphertext encrypted with a different key", () => {
    const ciphertext = encryptSecret("secret");
    process.env.INTEGRATION_ENCRYPTION_KEY =
      randomBytes(32).toString("base64");
    expect(() => decryptSecret(ciphertext)).toThrow();
  });

  it("rejects unknown formats and bad keys", () => {
    expect(() => decryptSecret("v2.whatever")).toThrow();
    process.env.INTEGRATION_ENCRYPTION_KEY = "tooshort";
    expect(() => encryptSecret("x")).toThrow();
  });
});
