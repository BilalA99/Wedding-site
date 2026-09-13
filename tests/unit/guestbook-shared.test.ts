import { describe, expect, it } from "vitest";

import {
  extensionForMime,
  formatBytes,
  formatDuration,
  isAllowedMime,
  maxBytesFor,
  sanitizeOriginalFileName,
  storedFileName,
} from "@/lib/guestbook-shared";

describe("isAllowedMime", () => {
  it("accepts phone video formats", () => {
    expect(isAllowedMime("video", "video/mp4")).toBe(true);
    expect(isAllowedMime("video", "video/quicktime")).toBe(true);
    expect(isAllowedMime("video", "VIDEO/QUICKTIME")).toBe(true);
    expect(isAllowedMime("video", "video/webm")).toBe(true);
  });

  it("accepts phone photo formats including HEIC", () => {
    expect(isAllowedMime("photo", "image/heic")).toBe(true);
    expect(isAllowedMime("photo", "image/jpeg")).toBe(true);
    expect(isAllowedMime("photo", "image/webp")).toBe(true);
  });

  it("rejects cross-type and unknown MIME types", () => {
    expect(isAllowedMime("video", "image/jpeg")).toBe(false);
    expect(isAllowedMime("photo", "video/mp4")).toBe(false);
    expect(isAllowedMime("video", "application/x-msdownload")).toBe(false);
    expect(isAllowedMime("photo", "image/svg+xml")).toBe(false);
  });
});

describe("maxBytesFor", () => {
  it("is 500 MB for video and 25 MB for photo", () => {
    expect(maxBytesFor("video")).toBe(500 * 1024 * 1024);
    expect(maxBytesFor("photo")).toBe(25 * 1024 * 1024);
  });
});

describe("storedFileName", () => {
  it("builds event_uuid.ext names", () => {
    const id = "3f2f1f38-9d1c-4e7a-b7f3-0a4c8f7a1e2d";
    expect(storedFileName("wedding", id, "video/quicktime")).toBe(
      `wedding_${id}.mov`,
    );
    expect(storedFileName("henna", id, "video/mp4")).toBe(`henna_${id}.mp4`);
    expect(storedFileName("general", id, "image/heic")).toBe(
      `general_${id}.heic`,
    );
  });

  it("falls back to .bin for unknown MIME", () => {
    expect(extensionForMime("application/unknown")).toBe("bin");
  });
});

describe("sanitizeOriginalFileName", () => {
  it("strips directory components", () => {
    expect(sanitizeOriginalFileName("C:\\Users\\x\\IMG_1.MOV")).toBe(
      "IMG_1.MOV",
    );
    expect(sanitizeOriginalFileName("../../etc/passwd")).toBe("passwd");
  });

  it("removes control characters and trims", () => {
    expect(sanitizeOriginalFileName("  clip\u0000\u001f name.mp4 ")).toBe(
      "clip name.mp4",
    );
  });

  it("caps length at 255", () => {
    expect(sanitizeOriginalFileName("a".repeat(400)).length).toBe(255);
  });
});

describe("formatters", () => {
  it("formats sizes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(125_000_000)).toBe("119.2 MB");
  });

  it("formats durations", () => {
    expect(formatDuration(83)).toBe("1:23");
    expect(formatDuration(120)).toBe("2:00");
    expect(formatDuration(5)).toBe("0:05");
  });
});
