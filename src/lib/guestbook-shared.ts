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
/** Event clips run as long as they run — Drive has the room, and a speech or
 * a first dance is exactly the thing worth keeping whole. */
export const MAX_EVENT_VIDEO_DURATION_SECONDS = null;
/** Slack for container metadata rounding (e.g. 120.4s recorded clips). */
export const VIDEO_DURATION_TOLERANCE_SECONDS = 1;

/** 5 GB. Storage is not the constraint (Drive holds 5 TB) and neither is the
 * server — bytes go browser→Drive in 8 MiB chunks and never touch a function.
 * This exists only so a mis-picked file can't start a hopeless upload; with
 * the duration cap gone it must be large enough not to become one by proxy
 * (4K/60 runs ~400 MB per minute). */
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Quality floor, enforced. Phone video is usually portrait (1080x1920), so the
 * SHORT edge is the meaningful dimension — 720 means "720p or better" in both
 * orientations. Recompressed shares (WhatsApp/Instagram exports land around
 * 480x854) are turned away rather than warned about: these are the wedding
 * videos, and a guest can almost always re-share the camera-roll original.
 *
 * Only a video we positively measured is rejected. A file the browser cannot
 * decode reports no dimensions and always passes — never punish a measurement
 * we failed to take.
 */
export const MIN_VIDEO_SHORT_EDGE = 720;

/** What the in-browser recorder asks the camera for: 1080p, capped there. */
export const TARGET_RECORD_WIDTH = 1920;
export const TARGET_RECORD_HEIGHT = 1080;

/** ~8 Mbps keeps 1080p crisp without bloating uploads on venue Wi-Fi. */
export const RECORD_VIDEO_BITS_PER_SECOND = 8_000_000;
export const RECORD_AUDIO_BITS_PER_SECOND = 128_000;
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

/** null means "no limit" — event media is deliberately uncapped. */
export function maxDurationFor(kind: GuestbookKind): number | null {
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

/** The smaller of the two dimensions — orientation-independent quality. */
export function videoShortEdge(
  width: number | null | undefined,
  height: number | null | undefined,
): number | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  return Math.min(width, height);
}

/** True only when we positively know the video is below the floor. An
 * undecodable file (HEVC in some browsers) reports nothing and is never
 * flagged — we don't nag guests over a measurement we couldn't take. */
export function isLowResolution(
  width: number | null | undefined,
  height: number | null | undefined,
): boolean {
  const edge = videoShortEdge(width, height);
  return edge != null && edge < MIN_VIDEO_SHORT_EDGE;
}

/** "1080p", "4K", "480p" — labelled by short edge, as video conventionally is. */
export function formatResolution(
  width: number | null | undefined,
  height: number | null | undefined,
): string | null {
  const edge = videoShortEdge(width, height);
  if (edge == null) return null;
  if (edge >= 2160) return "4K";
  if (edge >= 1440) return "1440p";
  if (edge >= 1080) return "1080p";
  if (edge >= 720) return "720p";
  if (edge >= 480) return "480p";
  if (edge >= 360) return "360p";
  return `${edge}p`;
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
