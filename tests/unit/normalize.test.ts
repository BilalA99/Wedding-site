import { describe, expect, it } from "vitest";

import { normalizeName, normalizePhone } from "@/lib/normalize";

describe("normalizeName", () => {
  it("lowercases, trims, collapses whitespace", () => {
    expect(normalizeName("  The   Ahmad  Family ")).toBe("the ahmad family");
  });

  it("strips superficial punctuation", () => {
    expect(normalizeName("O'Brien-Smith, Jr.")).toBe("o brien smith jr");
  });

  it("strips diacritics via unicode normalization", () => {
    expect(normalizeName("José Ålund")).toBe("jose alund");
  });

  it("matches equivalent names", () => {
    expect(normalizeName("Bilal & Jennah")).toBe(normalizeName("bilal & jennah  "));
  });
});

describe("normalizePhone", () => {
  it("keeps digits and plus only", () => {
    expect(normalizePhone("+1 (555) 555-0100")).toBe("+15555550100");
  });
});
