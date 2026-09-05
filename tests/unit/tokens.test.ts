import { describe, expect, it } from "vitest";

import {
  generateManageToken,
  hashManageToken,
  isPlausibleToken,
} from "@/lib/tokens";

describe("manage tokens", () => {
  it("generates 43-char base64url tokens (32 bytes of entropy)", () => {
    const token = generateManageToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generateManageToken()),
    );
    expect(tokens.size).toBe(200);
  });

  it("hashes deterministically and never stores the raw token", async () => {
    const token = generateManageToken();
    const h1 = await hashManageToken(token);
    const h2 = await hashManageToken(token);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(token);
    expect(h1).toMatch(/^[A-Za-z0-9_-]{43}$/); // sha-256 → 32 bytes base64url
  });

  it("different tokens hash differently", async () => {
    const h1 = await hashManageToken(generateManageToken());
    const h2 = await hashManageToken(generateManageToken());
    expect(h1).not.toBe(h2);
  });

  it("rejects implausible tokens fast", () => {
    expect(isPlausibleToken("short")).toBe(false);
    expect(isPlausibleToken("")).toBe(false);
    expect(isPlausibleToken("a".repeat(44))).toBe(false);
    expect(isPlausibleToken("!".repeat(43))).toBe(false);
    expect(isPlausibleToken(generateManageToken())).toBe(true);
  });
});
