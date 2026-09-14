// Client-safe guestbook constants — imported by both the guest UI and the
// server validators so the two can never drift apart. No secrets here.

export const GUESTBOOK_EVENTS = ["henna", "wedding", "general"] as const;
export type GuestbookEvent = (typeof GUESTBOOK_EVENTS)[number];

export const GUESTBOOK_MEDIA_TYPES = ["video", "photo"] as const;
export type GuestbookMediaType = (typeof GUESTBOOK_MEDIA_TYPES)[number];

/** Two lanes: a video/photo MESSAGE to the couple, or EVENT MEDIA captured
 * at the henna/wedding and shared in a batch. */
export const GUESTBOOK_KINDS = ["message", "event_media"] as const;
export type GuestbookKind = (typeof GUESTBOOK_KINDS)[number];

/** Hard product rule: video MESSAGES max out at 2 minutes. */
export const MAX_VIDEO_DURATION_SECONDS = 120;
/** Event clips can run longer — capped at 15 minutes. */
export const MAX_EVENT_VIDEO_DURATION_SECONDS = 15 * 60;
/** Slack for container metadata rounding (e.g. 120.4s recorded clips). */
export const VIDEO_DURATION_TOLERANCE_SECONDS = 1;

/** 500 MB — network reliability is the constraint, not storage. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
/** 25 MB covers every phone photo including multi-frame HEIC. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
/** Admin-gallery thumbnails are small WebP/JPEG frames. */
export const MAX_THUMBNAIL_BYTES = 400 * 1024;

export const MAX_GUEST_NAME_LENGTH = 120;
export const MAX_MESSAGE_LENGTH = 500;

/** Drive resumable chunks must be multiples of 256 KiB; 8 MiB balances
 * per-chunk retry cost against request overhead on venue Wi-Fi. */
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

/** One "Share Photos & Videos" batch is capped at 30 files. */
export const MAX_BATCH_ITEMS = 30;

export function maxDurationFor(kind: GuestbookKind): number {
  return kind === "event_media"
    ? MAX_EVENT_VIDEO_DURATION_SECONDS
    : MAX_VIDEO_DURATION_SECONDS;
}

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/3gpp",
] as const;

export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
] as const;

export const THUMBNAIL_MIME_TYPES = ["image/webp", "image/jpeg"] as const;

export function isAllowedMime(
  mediaType: GuestbookMediaType,
  mime: string,
): boolean {
  const list: readonly string[] =
    mediaType === "video" ? VIDEO_MIME_TYPES : PHOTO_MIME_TYPES;
  return list.includes(mime.toLowerCase());
}

export function maxBytesFor(mediaType: GuestbookMediaType): number {
  return mediaType === "video" ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

export function extensionForMime(mime: string): string {
  return EXTENSION_BY_MIME[mime.toLowerCase()] ?? "bin";
}

/**
 * Canonical Drive filename: `<event>_<uuid>.<ext>`. Raw phone filenames are
 * kept only as metadata — never as the stored name.
 */
export function storedFileName(
  event: GuestbookEvent,
  submissionId: string,
  mime: string,
): string {
  return `${event}_${submissionId}.${extensionForMime(mime)}`;
}

/** Strips control characters and path fragments from a client filename before
 * it is stored as metadata. */
export function sanitizeOriginalFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  let cleaned = "";
  for (const ch of base) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) cleaned += ch;
  }
  return cleaned.trim().slice(0, 255);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
