import { describe, expect, it } from "vitest";

import { csvEscape, parseCsv, toCsv } from "@/lib/csv";

describe("csvEscape", () => {
  it("passes plain values through", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(null)).toBe("");
  });

  it("quotes commas", () => {
    expect(csvEscape("Hamdan, Omar")).toBe('"Hamdan, Omar"');
  });

  it("doubles embedded quotes", () => {
    expect(csvEscape('the "big" day')).toBe('"the ""big"" day"');
  });

  it("quotes newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("line1\r\nline2")).toBe('"line1\r\nline2"');
  });
});

describe("toCsv", () => {
  it("produces CRLF rows with escaped fields", () => {
    const csv = toCsv(
      ["name", "note"],
      [["A, B", 'said "hi"\nthen left']],
    );
    expect(csv).toBe('name,note\r\n"A, B","said ""hi""\nthen left"\r\n');
  });
});

describe("parseCsv", () => {
  it("round-trips with toCsv", () => {
    const original = [
      ["name", "note"],
      ["A, B", 'said "hi"\nthen left'],
    ];
    const parsed = parseCsv(toCsv(original[0]!, [original[1]!]));
    expect(parsed).toEqual(original);
  });

  it("handles LF and CRLF", () => {
    expect(parseCsv("a,b\nc,d\r\ne,f")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });

  it("drops trailing empty lines", () => {
    expect(parseCsv("a,b\n")).toEqual([["a", "b"]]);
  });
});
