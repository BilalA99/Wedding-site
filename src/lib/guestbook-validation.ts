import { z } from "zod";

import {
  GUESTBOOK_EVENTS,
  GUESTBOOK_KINDS,
  GUESTBOOK_MEDIA_TYPES,
  MAX_GUEST_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_THUMBNAIL_BYTES,
  MIN_VIDEO_SHORT_EDGE,
  THUMBNAIL_MIME_TYPES,
  VIDEO_DURATION_TOLERANCE_SECONDS,
  formatResolution,
  isAllowedMime,
  isLowResolution,
  maxBytesFor,
  maxDurationFor,
} from "@/lib/guestbook-shared";

/** Trims and collapses inner whitespace runs; empty → undefined. */
const optionalTrimmed = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max))
    .transform((s) => (s === "" ? undefined : s))
    .optional();

export const uploadSessionSchema = z
  .object({
    submissionId: z.uuid(),
    event: z.enum(GUESTBOOK_EVENTS),
    mediaType: z.enum(GUESTBOOK_MEDIA_TYPES),
    kind: z.enum(GUESTBOOK_KINDS).default("message"),
    batchId: z.uuid().nullable().optional(),
    fileName: z.string().min(1).max(300),
    mimeType: z.string().min(1).max(100),
    fileSize: z.number().int().positive(),
    durationSeconds: z.number().nonnegative().max(86_400).nullable().optional(),
    /** Client-measured intrinsic dimensions; advisory only — recorded so the
     * admin gallery can show quality, never used to reject an upload. */
    videoWidth: z.number().int().positive().max(16_384).nullable().optional(),
    videoHeight: z.number().int().positive().max(16_384).nullable().optional(),
    guestName: optionalTrimmed(MAX_GUEST_NAME_LENGTH),
    message: optionalTrimmed(MAX_MESSAGE_LENGTH),
    thumbnail: z
      .object({
        mimeType: z.enum(THUMBNAIL_MIME_TYPES),
        fileSize: z.number().int().positive().max(MAX_THUMBNAIL_BYTES),
      })
      .nullable()
      .optional(),
    /** Honeypot — humans never see this field. */
    website: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (!isAllowedMime(val.mediaType, val.mimeType)) {
      ctx.addIssue({
        code: "custom",
        path: ["mimeType"],
        message:
          val.mediaType === "video"
            ? "That video format isn't supported."
            : "That photo format isn't supported.",
      });
    }
    if (val.fileSize > maxBytesFor(val.mediaType)) {
      ctx.addIssue({
        code: "custom",
        path: ["fileSize"],
        message: "This file is too large.",
      });
    }
    // Event media is deliberately uncapped, so maxDurationFor returns null
    // there and only the 2-minute message rule is enforced.
    const maxDuration = maxDurationFor(val.kind);
    if (
      val.mediaType === "video" &&
      maxDuration != null &&
      val.durationSeconds != null &&
      val.durationSeconds > maxDuration + VIDEO_DURATION_TOLERANCE_SECONDS
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["durationSeconds"],
        message: "This video is longer than 2 minutes.",
      });
    }
    // HD only. Dimensions are client-measured and optional — absent means the
    // browser could not decode the file, which must not count against it.
    if (
      val.mediaType === "video" &&
      isLowResolution(val.videoWidth, val.videoHeight)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["videoWidth"],
        message: `This video is only ${formatResolution(val.videoWidth, val.videoHeight)} — please share the original in ${MIN_VIDEO_SHORT_EDGE}p or better.`,
      });
    }
  });

export type UploadSessionInput = z.infer<typeof uploadSessionSchema>;

export const completeUploadSchema = z.object({
  submissionId: z.uuid(),
  driveFileId: z.string().min(5).max(200),
  driveThumbnailFileId: z.string().min(5).max(200).nullable().optional(),
});

export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

export const adminEditEntrySchema = z.object({
  guestName: optionalTrimmed(MAX_GUEST_NAME_LENGTH),
  message: optionalTrimmed(MAX_MESSAGE_LENGTH),
  event: z.enum(GUESTBOOK_EVENTS),
});
