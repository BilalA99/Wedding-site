import { describe, expect, it } from "vitest";

import {
  adminEditEntrySchema,
  completeUploadSchema,
  uploadSessionSchema,
} from "@/lib/guestbook-validation";

const base = {
  submissionId: "3f2f1f38-9d1c-4e7a-b7f3-0a4c8f7a1e2d",
  event: "wedding",
  mediaType: "video",
  fileName: "IMG_1234.MOV",
  mimeType: "video/quicktime",
  fileSize: 125_000_000,
  durationSeconds: 83,
  guestName: "Ahmed",
  message: "Congratulations!",
};

describe("uploadSessionSchema", () => {
  it("accepts a typical phone video", () => {
    const result = uploadSessionSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts anonymous submissions with no name or message", () => {
    const { guestName: _n, message: _m, ...rest } = base;
    const result = uploadSessionSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guestName).toBeUndefined();
      expect(result.data.message).toBeUndefined();
    }
  });

  it("rejects videos longer than 2 minutes", () => {
    const result = uploadSessionSchema.safeParse({
      ...base,
      durationSeconds: 125,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /2 minutes/.test(i.message))).toBe(
        true,
      );
    }
  });

  it("tolerates 120.9s metadata rounding", () => {
    const result = uploadSessionSchema.safeParse({
      ...base,
      durationSeconds: 120.9,
    });
    expect(result.success).toBe(true);
  });

  it("allows unknown duration (null) — browsers can't always read it", () => {
    const result = uploadSessionSchema.safeParse({
      ...base,
      durationSeconds: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects oversized videos", () => {
    const result = uploadSessionSchema.safeParse({
      ...base,
      fileSize: 501 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized photos at the photo cap", () => {
    const result = uploadSessionSchema.safeParse({
      ...base,
      mediaType: "photo",
      mimeType: "image/jpeg",
      fileName: "IMG.jpg",
      fileSize: 26 * 1024 * 1024,
      durationSeconds: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects MIME types outside the allowlist", () => {
    expect(
      uploadSessionSchema.safeParse({ ...base, mimeType: "application/pdf" })
        .success,
    ).toBe(false);
    expect(
      uploadSessionSchema.safeParse({
        ...base,
        mediaType: "photo",
        mimeType: "video/mp4",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid event and bad submission ids", () => {
    expect(
      uploadSessionSchema.safeParse({ ...base, event: "afterparty" }).success,
    ).toBe(false);
    expect(
      uploadSessionSchema.safeParse({ ...base, submissionId: "not-a-uuid" })
        .success,
    ).toBe(false);
  });

  it("trims and collapses whitespace in name/message", () => {
    const result = uploadSessionSchema.safeParse({
      ...base,
      guestName: "  Ahmed   K  ",
      message: "  Mabrouk!\n\nSo happy  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guestName).toBe("Ahmed K");
      expect(result.data.message).toBe("Mabrouk! So happy");
    }
  });

  it("rejects names/messages over the caps", () => {
    expect(
      uploadSessionSchema.safeParse({ ...base, guestName: "x".repeat(121) })
        .success,
    ).toBe(false);
    expect(
      uploadSessionSchema.safeParse({ ...base, message: "x".repeat(501) })
        .success,
    ).toBe(false);
  });

  it("accepts a webp thumbnail declaration and rejects oversized ones", () => {
    expect(
      uploadSessionSchema.safeParse({
        ...base,
        thumbnail: { mimeType: "image/webp", fileSize: 60_000 },
      }).success,
    ).toBe(true);
    expect(
      uploadSessionSchema.safeParse({
        ...base,
        thumbnail: { mimeType: "image/webp", fileSize: 5_000_000 },
      }).success,
    ).toBe(false);
    expect(
      uploadSessionSchema.safeParse({
        ...base,
        thumbnail: { mimeType: "image/png", fileSize: 60_000 },
      }).success,
    ).toBe(false);
  });
});

describe("completeUploadSchema", () => {
  it("accepts a completion payload", () => {
    expect(
      completeUploadSchema.safeParse({
        submissionId: base.submissionId,
        driveFileId: "1AbCdEfGhIjKlMnOp",
        driveThumbnailFileId: null,
      }).success,
    ).toBe(true);
  });

  it("rejects junk file ids", () => {
    expect(
      completeUploadSchema.safeParse({
        submissionId: base.submissionId,
        driveFileId: "x",
      }).success,
    ).toBe(false);
  });
});

describe("adminEditEntrySchema", () => {
  it("normalizes empty strings to undefined", () => {
    const result = adminEditEntrySchema.safeParse({
      guestName: "  ",
      message: "",
      event: "henna",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guestName).toBeUndefined();
      expect(result.data.message).toBeUndefined();
    }
  });
});

describe("uploadSessionSchema — lanes and batches", () => {
  it("defaults kind to message", () => {
    const result = uploadSessionSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.kind).toBe("message");
  });

  it("event_media allows clips longer than 2 minutes (up to 15)", () => {
    expect(
      uploadSessionSchema.safeParse({
        ...base,
        kind: "event_media",
        durationSeconds: 600,
      }).success,
    ).toBe(true);
    expect(
      uploadSessionSchema.safeParse({
        ...base,
        kind: "event_media",
        durationSeconds: 905,
      }).success,
    ).toBe(false);
  });

  it("message lane still enforces the 2-minute rule", () => {
    expect(
      uploadSessionSchema.safeParse({
        ...base,
        kind: "message",
        durationSeconds: 600,
      }).success,
    ).toBe(false);
  });

  it("accepts a uuid batchId and rejects junk", () => {
    expect(
      uploadSessionSchema.safeParse({
        ...base,
        kind: "event_media",
        batchId: "3f2f1f38-9d1c-4e7a-b7f3-0a4c8f7a1e2d",
      }).success,
    ).toBe(true);
    expect(
      uploadSessionSchema.safeParse({ ...base, batchId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      uploadSessionSchema.safeParse({ ...base, batchId: null }).success,
    ).toBe(true);
  });

  it("rejects unknown kinds", () => {
    expect(
      uploadSessionSchema.safeParse({ ...base, kind: "livestream" }).success,
    ).toBe(false);
  });
});
