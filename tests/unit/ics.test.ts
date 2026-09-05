import { describe, expect, it } from "vitest";

import { buildIcs } from "@/lib/ics";
import { getEvent } from "@/config/wedding";

describe("buildIcs", () => {
  it("renders the henna at 7:00 PM New York local time on Oct 3 2026", () => {
    const ics = buildIcs(getEvent("henna"));
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261003T190000");
    expect(ics).toContain("TZID:America/New_York");
    expect(ics).toContain("BEGIN:VTIMEZONE");
  });

  it("renders the wedding at 7:00 PM New York local time on Oct 4 2026", () => {
    const ics = buildIcs(getEvent("wedding"));
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261004T190000");
  });

  it("escapes commas in location", () => {
    const ics = buildIcs(getEvent("wedding"));
    expect(ics).toContain("Hilton Garden Inn New York/Staten Island\\, 1100");
  });

  it("uses CRLF line endings and valid structure", () => {
    const ics = buildIcs(getEvent("henna"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("END:VCALENDAR");
    // No unfolded line longer than 75 octets
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });
});
