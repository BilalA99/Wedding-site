"use client";

import {
  RECORD_AUDIO_BITS_PER_SECOND,
  RECORD_VIDEO_BITS_PER_SECOND,
  TARGET_RECORD_HEIGHT,
  TARGET_RECORD_WIDTH,
} from "@/lib/guestbook-shared";

/**
 * In-browser capture at an explicitly requested resolution.
 *
 * `<input type="file" capture>` hands the OS full control of the camera
 * preset, and plenty of Android builds hand back 480p. getUserMedia lets us
 * ask for 1080p and, just as importantly, *read back what we actually got*
 * so the guest can be told before they record two minutes of 480p.
 */

/** Ordered best-first. H.264 is preferred: it plays everywhere, including
 * Drive's preview and QuickTime, without a transcode. */
const MIME_CANDIDATES = [
  "video/mp4;codecs=h264,aac",
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=h264,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

export function pickRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

/** Strips the codecs parameter: the server allowlist and the Drive filename
 * extension both key off the bare type. */
export function baseMimeType(mime: string): string {
  return (mime.split(";")[0] ?? mime).trim().toLowerCase();
}

export function recorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    pickRecorderMimeType() != null
  );
}

export class CameraDeniedError extends Error {
  constructor() {
    super("Camera permission denied");
    this.name = "CameraDeniedError";
  }
}

export class CameraUnavailableError extends Error {
  constructor() {
    super("Camera unavailable");
    this.name = "CameraUnavailableError";
  }
}

/**
 * Opens the camera at the highest resolution it will give us, capped at
 * 1080p. `ideal` rather than `exact` so a device that tops out at 720p still
 * works instead of throwing OverconstrainedError.
 */
export async function openCamera(
  facingMode: "user" | "environment",
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: TARGET_RECORD_WIDTH },
        height: { ideal: TARGET_RECORD_HEIGHT },
        frameRate: { ideal: 30 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new CameraDeniedError();
    }
    throw new CameraUnavailableError();
  }
}

export interface StreamResolution {
  width: number | null;
  height: number | null;
}

/** What the camera actually gave us, as opposed to what we asked for. */
export function streamResolution(stream: MediaStream): StreamResolution {
  const settings = stream.getVideoTracks()[0]?.getSettings();
  return {
    width: settings?.width ?? null,
    height: settings?.height ?? null,
  };
}

export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

export interface ActiveRecording {
  stop: () => void;
}

/**
 * Drives a MediaRecorder over an open stream, resolving with the finished
 * file. The bitrate is set explicitly — left to itself Chrome picks ~2.5 Mbps
 * for 1080p, which is visibly soft on faces at a dim reception.
 */
export function startRecording(
  stream: MediaStream,
  onFinish: (file: File | null) => void,
): ActiveRecording {
  const mimeType = pickRecorderMimeType();
  if (!mimeType) {
    onFinish(null);
    return { stop: () => {} };
  }

  const chunks: BlobPart[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: RECORD_VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: RECORD_AUDIO_BITS_PER_SECOND,
    });
  } catch {
    // Some builds reject the bitrate hints; retry with the mime type alone.
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      onFinish(null);
      return { stop: () => {} };
    }
  }

  const base = baseMimeType(mimeType);
  const extension = base === "video/mp4" ? "mp4" : "webm";

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => {
    if (chunks.length === 0) return onFinish(null);
    const blob = new Blob(chunks, { type: base });
    onFinish(
      new File([blob], `guestbook-recording.${extension}`, { type: base }),
    );
  };
  recorder.onerror = () => onFinish(null);

  // Timeslice keeps chunks flowing so a long clip isn't held in one buffer.
  recorder.start(1000);

  return {
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
    },
  };
}
