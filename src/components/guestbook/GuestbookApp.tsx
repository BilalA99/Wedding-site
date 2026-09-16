"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  MAX_BATCH_ITEMS,
  MAX_GUEST_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_VIDEO_DURATION_SECONDS,
  MIN_VIDEO_SHORT_EDGE,
  VIDEO_DURATION_TOLERANCE_SECONDS,
  formatBytes,
  formatDuration,
  formatResolution,
  isAllowedMime,
  isLowResolution,
  maxBytesFor,
  maxDurationFor,
  type GuestbookEvent,
  type GuestbookMediaType,
} from "@/lib/guestbook-shared";
import {
  makePhotoThumbnail,
  makeVideoThumbnail,
  readVideoMetadata,
} from "@/components/guestbook/media";
import { recorderSupported } from "@/components/guestbook/recorder";
import { VideoRecorder } from "@/components/guestbook/VideoRecorder";
import {
  SessionExpiredError,
  UploadAbortedError,
  uploadResumable,
  uploadSmall,
} from "@/components/guestbook/uploader";
import { TatreezCluster } from "@/components/tatreez/Tatreez";

type Step =
  | "welcome"
  | "msgChoose"
  | "details"
  | "uploading"
  | "success"
  | "dump"
  | "dumpUploading"
  | "dumpSuccess";

interface SelectedMedia {
  file: File;
  mediaType: GuestbookMediaType;
  previewUrl: string;
  durationSeconds: number | null;
  /** Intrinsic video dimensions; null for photos or undecodable files. */
  width: number | null;
  height: number | null;
  submissionId: string;
}

type DumpStatus = "ready" | "uploading" | "done" | "failed" | "rejected";

interface DumpItem {
  submissionId: string;
  file: File;
  mediaType: GuestbookMediaType;
  /** Object URL for photo tiles; videos show an icon + duration instead. */
  previewUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  /** Metadata is still being read in the background. Never blocks upload. */
  probing: boolean;
  status: DumpStatus;
  /** Why the file can't be uploaded (rejected) or failed. */
  note: string | null;
  sentBytes: number;
}

const EVENT_OPTIONS: { value: GuestbookEvent; label: string }[] = [
  { value: "henna", label: "Henna" },
  { value: "wedding", label: "Wedding" },
  { value: "general", label: "For Both" },
];

const DUMP_EVENT_OPTIONS = EVENT_OPTIONS.filter(
  (o) => o.value !== "general",
);

const inputClass =
  "w-full rounded-sm border border-line-blue bg-paper px-4 py-3.5 text-base text-ink placeholder:text-ink-soft/50 transition-colors duration-300 focus:border-dusty";
const labelClass = "type-caps mb-2 block text-[0.62rem] text-blue-deep";
const primaryBtnClass =
  "type-caps min-h-13 w-full rounded-sm bg-blue-deep px-8 py-4 text-[0.7rem] text-paper-pure transition-colors duration-300 hover:bg-ink disabled:opacity-40";
const secondaryBtnClass =
  "type-caps min-h-11 w-full rounded-sm border border-line-blue px-8 py-3 text-[0.62rem] text-ink-soft transition-colors duration-300 hover:border-dusty hover:text-ink";

const DRAFT_KEY = "gb_draft";

function loadDraft(): { name?: string; message?: string; event?: GuestbookEvent } {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ReturnType<typeof loadDraft>) : {};
  } catch {
    return {};
  }
}

/** Camera support can't change over the life of the page — nothing to subscribe to. */
const subscribeNever = () => () => {};

function mediaTypeOf(file: File): GuestbookMediaType | null {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "photo";
  return null;
}

export function GuestbookApp({
  initialEvent,
}: {
  initialEvent: GuestbookEvent | null;
}) {
  const reducedMotion = useReducedMotion();

  const [step, setStep] = useState<Step>("welcome");
  const [event, setEvent] = useState<GuestbookEvent>(initialEvent ?? "general");
  const [eventChosen, setEventChosen] = useState(initialEvent != null);
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [inspecting, setInspecting] = useState(false);

  // ---- batch ("dump") state -----------------------------------------------
  const [dumpItems, setDumpItems] = useState<DumpItem[]>([]);
  const [dumpEvent, setDumpEvent] = useState<GuestbookEvent>(
    initialEvent === "wedding" ? "wedding" : "henna",
  );
  const [batchId, setBatchId] = useState<string>(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "",
  );
  const [dumpFinished, setDumpFinished] = useState(false);
  const [dumpDoneCount, setDumpDoneCount] = useState(0);
  const [recording, setRecording] = useState(false);

  const thumbnailRef = useRef<Blob | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const recordInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const dumpInputRef = useRef<HTMLInputElement>(null);
  // Source of truth for batch items lives in this ref (mutated only inside
  // handlers); setDumpItems mirrors it into state for rendering.
  const dumpItemsRef = useRef<DumpItem[]>([]);
  // Bumped when the batch is cleared, so a background probe still in flight
  // can tell it belongs to an abandoned batch and stop.
  const probeGenerationRef = useRef(0);

  /** MediaRecorder support is unknowable on the server, so the markup renders
   * as "no recorder" and settles on the client without a hydration mismatch. */
  const canRecord = useSyncExternalStore(
    subscribeNever,
    recorderSupported,
    () => false,
  );

  // Restore lightweight draft fields after hydration (never media bytes).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const draft = loadDraft();
      if (draft.name) setGuestName(draft.name);
      if (draft.message) setMessage(draft.message);
      if (!initialEvent && draft.event) {
        setEvent(draft.event);
        setEventChosen(true);
        if (draft.event !== "general") setDumpEvent(draft.event);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [initialEvent]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ name: guestName, message, event }),
      );
    } catch {
      // Private-mode storage failures are fine — the draft is a convenience.
    }
  }, [guestName, message, event]);

  // Warn on leave only while an upload is running.
  const uploadingNow = step === "uploading" || step === "dumpUploading";
  useEffect(() => {
    if (!uploadingNow) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploadingNow]);

  // Move focus to the step heading on transitions (screen-reader context).
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const releaseMedia = useCallback((m: SelectedMedia | null) => {
    if (m) URL.revokeObjectURL(m.previewUrl);
  }, []);

  useEffect(() => () => releaseMedia(media), [media, releaseMedia]);
  useEffect(
    () => () => {
      for (const item of dumpItemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );

  // ---- message lane -------------------------------------------------------

  const handleFile = useCallback(
    async (file: File | undefined, mediaType: GuestbookMediaType) => {
      if (!file) return;
      setError(null);

      const mime = file.type || "";
      if (mime && !isAllowedMime(mediaType, mime)) {
        setError(
          mediaType === "video"
            ? "That video format isn't supported. Please choose an MP4, MOV, or WebM video."
            : "That photo format isn't supported. Please choose a JPEG, PNG, HEIC, or WebP photo.",
        );
        return;
      }
      if (file.size > maxBytesFor(mediaType)) {
        setError(
          mediaType === "video"
            ? `This file is too large. Videos can be up to ${formatBytes(maxBytesFor("video"))}.`
            : `This file is too large. Photos can be up to ${formatBytes(maxBytesFor("photo"))}.`,
        );
        return;
      }

      setInspecting(true);
      let durationSeconds: number | null = null;
      let width: number | null = null;
      let height: number | null = null;
      if (mediaType === "video") {
        const meta = await readVideoMetadata(file);
        durationSeconds = meta.durationSeconds;
        width = meta.width;
        height = meta.height;
        if (
          durationSeconds != null &&
          durationSeconds >
            MAX_VIDEO_DURATION_SECONDS + VIDEO_DURATION_TOLERANCE_SECONDS
        ) {
          setInspecting(false);
          setError(
            "This video is longer than 2 minutes. Please record or choose a shorter one.",
          );
          return;
        }
      }

      // Thumbnail generation starts now so it's ready before upload.
      thumbnailRef.current = null;
      void (mediaType === "video"
        ? makeVideoThumbnail(file)
        : makePhotoThumbnail(file)
      ).then((blob) => {
        thumbnailRef.current = blob;
      });

      setMedia((prev) => {
        releaseMedia(prev);
        return {
          file,
          mediaType,
          previewUrl: URL.createObjectURL(file),
          durationSeconds,
          width,
          height,
          submissionId: crypto.randomUUID(),
        };
      });
      setInspecting(false);
      setStep("details");
    },
    [releaseMedia],
  );

  const requestSession = useCallback(
    async (opts: {
      submissionId: string;
      file: File;
      mediaType: GuestbookMediaType;
      durationSeconds: number | null;
      width: number | null;
      height: number | null;
      kind: "message" | "event_media";
      forEvent: GuestbookEvent;
      thumb: Blob | null;
    }) => {
      const res = await fetch("/api/guestbook/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: opts.submissionId,
          event: opts.forEvent,
          mediaType: opts.mediaType,
          kind: opts.kind,
          batchId: opts.kind === "event_media" ? batchId : null,
          fileName: opts.file.name || "memory",
          mimeType: opts.file.type || "application/octet-stream",
          fileSize: opts.file.size,
          durationSeconds: opts.durationSeconds,
          videoWidth: opts.width,
          videoHeight: opts.height,
          guestName: guestName || undefined,
          message: message || undefined,
          thumbnail:
            opts.thumb &&
            (opts.thumb.type === "image/webp" || opts.thumb.type === "image/jpeg")
              ? { mimeType: opts.thumb.type, fileSize: opts.thumb.size }
              : null,
          website: "",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        uploadUrl?: string | null;
        thumbnailUploadUrl?: string | null;
      };
      if (!res.ok || !json.uploadUrl) {
        throw new Error(
          json.error ??
            "Google Drive is temporarily unavailable. Your memory is still on your phone.",
        );
      }
      return json;
    },
    [batchId, guestName, message],
  );

  /** Uploads one file end-to-end; returns when the server confirms it. */
  const uploadOne = useCallback(
    async (opts: {
      submissionId: string;
      file: File;
      mediaType: GuestbookMediaType;
      durationSeconds: number | null;
      width: number | null;
      height: number | null;
      kind: "message" | "event_media";
      forEvent: GuestbookEvent;
      thumb: Blob | null;
      signal: AbortSignal;
      onProgress: (sent: number, total: number) => void;
    }) => {
      let session = await requestSession(opts);

      let thumbnailFileId: string | null = null;
      if (session.thumbnailUploadUrl && opts.thumb) {
        const r = await uploadSmall(
          opts.thumb,
          session.thumbnailUploadUrl,
          opts.signal,
        );
        thumbnailFileId = r?.fileId ?? null;
      }

      let fileId: string | null = null;
      for (let attempt = 0; attempt < 2 && !fileId; attempt++) {
        try {
          const result = await uploadResumable(opts.file, session.uploadUrl!, {
            signal: opts.signal,
            onProgress: opts.onProgress,
          });
          fileId = result.fileId;
        } catch (err) {
          if (err instanceof SessionExpiredError && attempt === 0) {
            opts.onProgress(0, opts.file.size);
            session = await requestSession(opts);
            continue;
          }
          throw err;
        }
      }
      if (!fileId) throw new Error("Upload could not be completed.");

      const completeRes = await fetch("/api/guestbook/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: opts.submissionId,
          driveFileId: fileId,
          driveThumbnailFileId: thumbnailFileId,
        }),
      });
      if (!completeRes.ok) {
        const json = (await completeRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          json.error ?? "We couldn't confirm your upload. Tap Retry to continue.",
        );
      }
    },
    [requestSession],
  );

  const startUpload = useCallback(async () => {
    if (!media) return;
    setError(null);
    setProgress(0);
    setStep("uploading");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await uploadOne({
        submissionId: media.submissionId,
        file: media.file,
        mediaType: media.mediaType,
        durationSeconds: media.durationSeconds,
        width: media.width,
        height: media.height,
        kind: "message",
        forEvent: event,
        thumb: thumbnailRef.current,
        signal: abort.signal,
        onProgress: (sent, total) => setProgress(total > 0 ? sent / total : 0),
      });
      setStep("success");
    } catch (err) {
      if (err instanceof UploadAbortedError) return;
      setStep("details");
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Your connection dropped. Tap Upload to try again.",
      );
    } finally {
      abortRef.current = null;
    }
  }, [media, event, uploadOne]);

  const resetForAnother = useCallback(() => {
    setMedia((prev) => {
      releaseMedia(prev);
      return null;
    });
    thumbnailRef.current = null;
    setProgress(0);
    setError(null);
    setStep("welcome");
  }, [releaseMedia]);

  // ---- dump lane ----------------------------------------------------------

  const updateItem = useCallback(
    (submissionId: string, patch: Partial<DumpItem>) => {
      dumpItemsRef.current = dumpItemsRef.current.map((it) =>
        it.submissionId === submissionId ? { ...it, ...patch } : it,
      );
      setDumpItems(dumpItemsRef.current);
    },
    [],
  );

  /**
   * Reads video metadata one file at a time, in the background.
   *
   * This cannot happen while the guest is still on the picker: probing a video
   * forces the OS to materialize the file — on iOS that means exporting it out
   * of Photos, including an iCloud download for anything not on-device — and
   * doing that for a whole camera-roll dump froze the selection screen for
   * minutes. Upload never waits on this; the results only enrich the tiles.
   */
  const probeDumpVideos = useCallback(
    async (items: DumpItem[], generation: number) => {
      for (const item of items) {
        if (probeGenerationRef.current !== generation) return;

        // Skip anything the guest removed, or that is already uploading.
        const before = dumpItemsRef.current.find(
          (i) => i.submissionId === item.submissionId,
        );
        if (!before || before.status !== "ready") continue;

        const meta = await readVideoMetadata(item.file);
        if (probeGenerationRef.current !== generation) return;

        const after = dumpItemsRef.current.find(
          (i) => i.submissionId === item.submissionId,
        );
        if (!after) continue;

        const patch: Partial<DumpItem> = {
          durationSeconds: meta.durationSeconds,
          width: meta.width,
          height: meta.height,
          probing: false,
        };

        const tooLong =
          meta.durationSeconds != null &&
          meta.durationSeconds >
            maxDurationFor("event_media") + VIDEO_DURATION_TOLERANCE_SECONDS;

        // Only a file that has not started uploading can still be turned away.
        if (tooLong && after.status === "ready") {
          patch.status = "rejected";
          patch.note = "Longer than 15 minutes";
        } else if (isLowResolution(meta.width, meta.height)) {
          patch.note = `${formatResolution(meta.width, meta.height)} — a compressed copy`;
        }

        updateItem(item.submissionId, patch);
      }
    },
    [updateItem],
  );

  const handleDumpFiles = useCallback(
    (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const existing = dumpItemsRef.current;
    let readyCount = existing.filter((i) => i.status !== "rejected").length;
    const additions: DumpItem[] = [];

    for (const file of Array.from(files)) {
      const mediaType = mediaTypeOf(file);
      const base: DumpItem = {
        submissionId: crypto.randomUUID(),
        file,
        mediaType: mediaType ?? "photo",
        previewUrl: null,
        durationSeconds: null,
        width: null,
        height: null,
        probing: false,
        status: "ready",
        note: null,
        sentBytes: 0,
      };

      if (!mediaType || !isAllowedMime(mediaType, file.type || "")) {
        additions.push({
          ...base,
          status: "rejected",
          note: "Format not supported",
        });
        continue;
      }
      if (file.size > maxBytesFor(mediaType)) {
        additions.push({ ...base, status: "rejected", note: "Too large" });
        continue;
      }
      if (readyCount >= MAX_BATCH_ITEMS) {
        additions.push({
          ...base,
          status: "rejected",
          note: `Batch is full (max ${MAX_BATCH_ITEMS})`,
        });
        continue;
      }

      // Everything above is free — type and size are metadata, no bytes are
      // touched. Duration and resolution are read later, off the hot path.
      readyCount += 1;
      additions.push({
        ...base,
        mediaType,
        probing: mediaType === "video",
        previewUrl: mediaType === "photo" ? URL.createObjectURL(file) : null,
      });
    }

    dumpItemsRef.current = [...dumpItemsRef.current, ...additions];
    setDumpItems(dumpItemsRef.current);

    void probeDumpVideos(
      additions.filter((i) => i.mediaType === "video" && i.status === "ready"),
      probeGenerationRef.current,
    );
    },
    [probeDumpVideos],
  );

  const removeDumpItem = useCallback((submissionId: string) => {
    const item = dumpItemsRef.current.find(
      (i) => i.submissionId === submissionId,
    );
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    dumpItemsRef.current = dumpItemsRef.current.filter(
      (i) => i.submissionId !== submissionId,
    );
    setDumpItems(dumpItemsRef.current);
  }, []);

  const resetDump = useCallback(() => {
    for (const item of dumpItemsRef.current) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    // Orphan any probe still running against the batch being thrown away.
    probeGenerationRef.current += 1;
    dumpItemsRef.current = [];
    setDumpItems([]);
    setBatchId(crypto.randomUUID());
    setDumpFinished(false);
    setDumpDoneCount(0);
    setProgress(0);
    setError(null);
  }, []);

  const startDumpUpload = useCallback(async () => {
    const queue = dumpItemsRef.current.filter(
      (i) => i.status === "ready" || i.status === "failed",
    );
    if (queue.length === 0) return;
    setError(null);
    setDumpFinished(false);
    setStep("dumpUploading");

    const abort = new AbortController();
    abortRef.current = abort;

    const doneBefore = dumpItemsRef.current.filter(
      (i) => i.status === "done",
    );
    const totalBytes =
      queue.reduce((s, i) => s + i.file.size, 0) +
      doneBefore.reduce((s, i) => s + i.file.size, 0);
    let settledBytes = doneBefore.reduce((s, i) => s + i.file.size, 0);
    setProgress(totalBytes > 0 ? settledBytes / totalBytes : 0);

    for (const item of queue) {
      if (abort.signal.aborted) break;
      updateItem(item.submissionId, { status: "uploading", note: null });
      try {
        const thumb =
          item.mediaType === "video"
            ? await makeVideoThumbnail(item.file)
            : await makePhotoThumbnail(item.file);
        await uploadOne({
          submissionId: item.submissionId,
          file: item.file,
          mediaType: item.mediaType,
          durationSeconds: item.durationSeconds,
          width: item.width,
          height: item.height,
          kind: "event_media",
          forEvent: dumpEvent,
          thumb,
          signal: abort.signal,
          onProgress: (sent, total) => {
            updateItem(item.submissionId, { sentBytes: sent });
            setProgress(
              totalBytes > 0
                ? Math.min(1, (settledBytes + Math.min(sent, total)) / totalBytes)
                : 0,
            );
          },
        });
        settledBytes += item.file.size;
        updateItem(item.submissionId, { status: "done" });
        setProgress(totalBytes > 0 ? settledBytes / totalBytes : 1);
      } catch (err) {
        if (err instanceof UploadAbortedError) {
          updateItem(item.submissionId, { status: "ready", sentBytes: 0 });
          break;
        }
        updateItem(item.submissionId, {
          status: "failed",
          sentBytes: 0,
          note:
            err instanceof Error && err.message
              ? err.message
              : "Upload failed",
        });
      }
    }

    abortRef.current = null;
    if (abort.signal.aborted) {
      setStep("dump");
      return;
    }

    const items = dumpItemsRef.current;
    const done = items.filter((i) => i.status === "done").length;
    const failed = items.filter((i) => i.status === "failed").length;
    setDumpDoneCount(done);
    if (failed === 0) {
      setStep("dumpSuccess");
    } else {
      setDumpFinished(true); // stay on the upload screen with a retry option
    }
  }, [dumpEvent, updateItem, uploadOne]);

  // ---- shared bits --------------------------------------------------------

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

  const percent = Math.round(progress * 100);
  const readyItems = dumpItems.filter(
    (i) => i.status === "ready" || i.status === "failed",
  );
  const rejectedItems = dumpItems.filter((i) => i.status === "rejected");
  const doneItems = dumpItems.filter((i) => i.status === "done");
  const uploadableCount = readyItems.length;
  const currentUpload = dumpItems.find((i) => i.status === "uploading");

  const backToWelcome = (
    <button
      type="button"
      onClick={() => {
        setError(null);
        setStep("welcome");
      }}
      className="type-caps mb-6 inline-flex min-h-9 items-center gap-1.5 text-[0.6rem] text-ink-soft transition-colors hover:text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 5 8 12l7 7" />
      </svg>
      Back
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-md px-6 pt-24 pb-16 md:max-w-lg">
      {/* Screen-reader status announcements */}
      <p aria-live="polite" className="sr-only">
        {step === "uploading" || step === "dumpUploading"
          ? `Uploading, ${percent} percent complete`
          : step === "success" || step === "dumpSuccess"
            ? "Your memories were saved. Thank you."
            : ""}
      </p>

      {recording && (
        <VideoRecorder
          maxSeconds={MAX_VIDEO_DURATION_SECONDS}
          onCancel={() => setRecording(false)}
          onComplete={(file) => {
            setRecording(false);
            void handleFile(file, "video");
          }}
        />
      )}

      {/* Hidden pickers */}
      <input
        ref={recordInputRef}
        type="file"
        accept="video/*"
        capture="user"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e.target.files?.[0], "video");
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/*"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e.target.files?.[0], "video");
          e.target.value = "";
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e.target.files?.[0], "photo");
          e.target.value = "";
        }}
      />
      <input
        ref={dumpInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          void handleDumpFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {step === "welcome" && (
          <motion.section
            key="welcome"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={transition}
          >
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/image/monogram.webp"
                alt=""
                className="mx-auto h-14 w-14 object-contain"
                draggable={false}
              />
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="type-display mt-6 text-4xl text-ink outline-none md:text-5xl"
              >
                Share a Memory
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Leave Bilal&nbsp;&amp;&nbsp;Jennah a message, or send them
                everything you captured at the celebration.
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-4">
              <LaneCard
                title="Leave Us a Message"
                copy="Record or upload a short video message — up to 2 minutes — or share a single photo."
                icon={<CameraIcon className="h-7 w-7" />}
                onClick={() => {
                  setError(null);
                  setStep("msgChoose");
                }}
              />
              <LaneCard
                title="Share Photos & Videos"
                copy="Dump your camera roll from the Henna or the Wedding — photos and clips, up to 30 at a time."
                icon={<StackIcon className="h-7 w-7" />}
                onClick={() => {
                  setError(null);
                  setStep("dump");
                }}
              />
            </div>
          </motion.section>
        )}

        {step === "msgChoose" && (
          <motion.section
            key="msgChoose"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={transition}
          >
            {backToWelcome}
            <div className="text-center">
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="type-display text-4xl text-ink outline-none md:text-5xl"
              >
                Leave Us a Message
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Record a memory for Bilal&nbsp;&amp;&nbsp;Jennah — a wish, a
                story, or a moment from the celebration.
              </p>
            </div>

            <fieldset className="mt-8">
              <legend className={`${labelClass} text-center`}>
                This memory is for
              </legend>
              <div
                className="flex justify-center gap-2"
                role="radiogroup"
                aria-label="Choose an event"
              >
                {EVENT_OPTIONS.map((opt) => {
                  const selected = eventChosen && event === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setEvent(opt.value);
                        setEventChosen(true);
                      }}
                      className={`min-h-11 rounded-full border px-5 py-2 font-display text-base transition-all duration-300 ${
                        selected
                          ? "border-blue-deep bg-blue-deep text-paper-pure"
                          : "border-line-blue bg-paper text-ink hover:border-dusty"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {error && (
              <p
                role="alert"
                className="mt-6 rounded-sm border border-error/30 bg-error/5 px-4 py-3 text-center text-sm text-error"
              >
                {error}
              </p>
            )}

            <div className="mt-10 flex flex-col items-center gap-4">
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                onClick={() =>
                  canRecord
                    ? setRecording(true)
                    : recordInputRef.current?.click()
                }
                disabled={inspecting}
                className="group flex flex-col items-center gap-3 disabled:opacity-50"
              >
                <span className="relative flex h-28 w-28 items-center justify-center rounded-full border border-powder bg-ice transition-colors duration-300 group-hover:border-dusty">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full border border-dusty/25 motion-safe:animate-[gb-ring_3.2s_ease-in-out_infinite]"
                  />
                  <CameraIcon className="h-9 w-9 text-blue-deep" />
                </span>
                <span className="font-display text-xl text-ink">
                  Record a Video
                </span>
                <span className="type-caps -mt-2 text-[0.58rem] text-ink-soft">
                  Up to 2 minutes{canRecord ? " · HD" : ""}
                </span>
              </motion.button>

              <div className="mt-2 grid w-full grid-cols-2 gap-3">
                <SecondaryAction
                  label="Choose a Video"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={inspecting}
                  icon={<FilmIcon className="h-5 w-5" />}
                />
                <SecondaryAction
                  label="Share a Photo"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={inspecting}
                  icon={<PhotoIcon className="h-5 w-5" />}
                />
              </div>
              {inspecting && (
                <p className="text-sm text-ink-soft" aria-live="polite">
                  Preparing your file…
                </p>
              )}
            </div>
          </motion.section>
        )}

        {step === "details" && media && (
          <motion.section
            key="details"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={transition}
          >
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="type-display text-center text-3xl text-ink outline-none md:text-4xl"
            >
              Your Memory
            </h1>

            <div className="mt-6 overflow-hidden rounded-sm border border-line-blue bg-ice">
              {media.mediaType === "video" ? (
                <video
                  src={media.previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-105 w-full bg-ink/5 object-contain"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={media.previewUrl}
                  alt="Preview of your selected photo"
                  className="max-h-105 w-full object-contain"
                />
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-blue px-4 py-2.5 text-xs text-ink-soft">
                <span className="font-display text-sm text-ink">
                  {EVENT_OPTIONS.find((o) => o.value === event)?.label}
                </span>
                {media.durationSeconds != null && (
                  <span className="tabular">
                    {formatDuration(media.durationSeconds)}
                  </span>
                )}
                <span className="tabular">{formatBytes(media.file.size)}</span>
                {formatResolution(media.width, media.height) && (
                  <span
                    className={`tabular ${
                      isLowResolution(media.width, media.height)
                        ? "text-error"
                        : ""
                    }`}
                  >
                    {formatResolution(media.width, media.height)}
                  </span>
                )}
              </div>
            </div>

            {isLowResolution(media.width, media.height) && (
              <div className="mt-4 rounded-sm border border-error/30 bg-error/5 px-4 py-3">
                <p className="text-sm text-ink">
                  This copy is only{" "}
                  {formatResolution(media.width, media.height)}. It looks like a
                  version that&rsquo;s been shared through WhatsApp or
                  Instagram, which compresses video heavily.
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  If the original is still in your camera roll, sharing that
                  instead will look far sharper ({MIN_VIDEO_SHORT_EDGE}p or
                  better). Otherwise this is perfectly fine to send.
                </p>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="type-caps mt-3 text-[0.6rem] text-blue-deep underline underline-offset-4"
                >
                  Pick a different video
                </button>
              </div>
            )}

            <div className="mt-7 flex flex-col gap-5">
              <div>
                <label htmlFor="gb-name" className={labelClass}>
                  Your name <span className="normal-case">(optional)</span>
                </label>
                <input
                  id="gb-name"
                  type="text"
                  autoComplete="name"
                  maxLength={MAX_GUEST_NAME_LENGTH}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="So Bilal & Jennah know who this is from"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="gb-message" className={labelClass}>
                  A short note <span className="normal-case">(optional)</span>
                </label>
                <textarea
                  id="gb-message"
                  rows={3}
                  maxLength={MAX_MESSAGE_LENGTH}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Congratulations!"
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-sm border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
              >
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3">
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                onClick={() => void startUpload()}
                className={primaryBtnClass}
              >
                {media.mediaType === "video" ? "Upload Message" : "Upload Photo"}
              </motion.button>
              <button
                type="button"
                onClick={() => {
                  setMedia((prev) => {
                    releaseMedia(prev);
                    return null;
                  });
                  thumbnailRef.current = null;
                  setError(null);
                  setStep("msgChoose");
                }}
                className={secondaryBtnClass}
              >
                Choose Another
              </button>
            </div>
          </motion.section>
        )}

        {step === "uploading" && (
          <motion.section
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="flex flex-col items-center pt-10 text-center"
          >
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="type-display text-3xl text-ink outline-none md:text-4xl"
            >
              Uploading your memory
            </h1>

            <ProgressRing percent={percent} progress={progress} />

            <p className="mt-10 text-sm text-ink-soft">
              Please keep this page open while your memory uploads.
            </p>
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                setStep("details");
              }}
              className="type-caps mt-6 min-h-11 px-4 py-2 text-[0.6rem] text-ink-soft transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </motion.section>
        )}

        {step === "success" && (
          <SuccessSection
            key="success"
            headingRef={headingRef}
            transition={transition}
            heading="Memory Saved"
            copy="Thank you for leaving us a message."
            primaryLabel="Share More Memories"
            onPrimary={resetForAnother}
          />
        )}

        {step === "dump" && (
          <motion.section
            key="dump"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={transition}
          >
            {backToWelcome}
            <div className="text-center">
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="type-display text-4xl text-ink outline-none md:text-5xl"
              >
                Share Photos &amp; Videos
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Everything you captured goes straight to
                Bilal&nbsp;&amp;&nbsp;Jennah&apos;s private collection.
              </p>
            </div>

            <fieldset className="mt-8">
              <legend className={`${labelClass} text-center`}>
                These are from
              </legend>
              <div
                className="flex justify-center gap-2"
                role="radiogroup"
                aria-label="Which event are these from?"
              >
                {DUMP_EVENT_OPTIONS.map((opt) => {
                  const selected = dumpEvent === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setDumpEvent(opt.value)}
                      className={`min-h-11 rounded-full border px-6 py-2 font-display text-base transition-all duration-300 ${
                        selected
                          ? "border-blue-deep bg-blue-deep text-paper-pure"
                          : "border-line-blue bg-paper text-ink hover:border-dusty"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {dumpItems.length === 0 ? (
              <button
                type="button"
                onClick={() => dumpInputRef.current?.click()}
                className="mt-8 flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-powder bg-ice/60 px-6 py-10 transition-colors duration-300 hover:border-dusty disabled:opacity-50"
              >
                <StackIcon className="h-9 w-9 text-blue-deep" />
                <span className="font-display text-xl text-ink">
                  Add Photos &amp; Videos
                </span>
                <span className="type-caps text-[0.58rem] text-ink-soft">
                  Up to {MAX_BATCH_ITEMS} at a time · videos up to 15 min
                </span>
              </button>
            ) : (
              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-lg text-ink">
                    {uploadableCount + doneItems.length}{" "}
                    {uploadableCount + doneItems.length === 1
                      ? "memory"
                      : "memories"}{" "}
                    selected
                  </p>
                  <button
                    type="button"
                    onClick={() => dumpInputRef.current?.click()}
                    className="type-caps min-h-9 px-2 text-[0.6rem] text-blue-deep transition-colors hover:text-ink"
                  >
                    + Add More
                  </button>
                </div>

                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {dumpItems.map((item) => (
                    <li key={item.submissionId} className="relative">
                      <DumpTile item={item} />
                      {item.status !== "done" && (
                        <button
                          type="button"
                          onClick={() => removeDumpItem(item.submissionId)}
                          aria-label={`Remove ${item.file.name}`}
                          className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-line-blue bg-paper text-ink-soft shadow-sm transition-colors hover:text-error"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            aria-hidden="true"
                          >
                            <path d="m7 7 10 10M17 7 7 17" />
                          </svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {rejectedItems.length > 0 && (
                  <p className="mt-3 text-xs text-error">
                    {rejectedItems.length}{" "}
                    {rejectedItems.length === 1 ? "file" : "files"} can&apos;t be
                    uploaded — see the marked tiles.
                  </p>
                )}
              </div>
            )}

            <div className="mt-7 flex flex-col gap-5">
              <div>
                <label htmlFor="gb-dump-name" className={labelClass}>
                  Your name <span className="normal-case">(optional)</span>
                </label>
                <input
                  id="gb-dump-name"
                  type="text"
                  autoComplete="name"
                  maxLength={MAX_GUEST_NAME_LENGTH}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="So Bilal & Jennah know who these are from"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="gb-dump-message" className={labelClass}>
                  A short note <span className="normal-case">(optional)</span>
                </label>
                <textarea
                  id="gb-dump-message"
                  rows={2}
                  maxLength={MAX_MESSAGE_LENGTH}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="From the dance floor!"
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-sm border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
              >
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3">
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                onClick={() => void startDumpUpload()}
                disabled={uploadableCount === 0}
                className={primaryBtnClass}
              >
                {uploadableCount === 0
                  ? "Upload"
                  : uploadableCount === 1
                    ? "Upload 1 Memory"
                    : `Upload ${uploadableCount} Memories`}
              </motion.button>
            </div>
          </motion.section>
        )}

        {step === "dumpUploading" && (
          <motion.section
            key="dumpUploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="flex flex-col items-center pt-6 text-center"
          >
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="type-display text-3xl text-ink outline-none md:text-4xl"
            >
              {dumpFinished ? "Almost there" : "Uploading your memories"}
            </h1>

            <ProgressRing percent={percent} progress={progress} />

            <p className="mt-8 text-sm text-ink-soft" aria-live="polite">
              {dumpFinished
                ? `${doneItems.length} of ${doneItems.length + readyItems.length} uploaded — ${readyItems.length} didn't make it.`
                : currentUpload
                  ? `Uploading ${doneItems.length + 1} of ${doneItems.length + readyItems.length + 1}`
                  : "Please keep this page open while your memories upload."}
            </p>

            <ul className="mt-6 max-h-48 w-full overflow-y-auto rounded-sm border border-line-blue bg-ice/50 px-4 py-3 text-left">
              {dumpItems
                .filter((i) => i.status !== "rejected")
                .map((item) => (
                  <li
                    key={item.submissionId}
                    className="flex items-center gap-2 py-1 text-xs text-ink-soft"
                  >
                    <StatusDot status={item.status} />
                    <span className="min-w-0 flex-1 truncate">
                      {item.file.name || "Memory"}
                    </span>
                    {item.status === "uploading" && (
                      <span className="tabular shrink-0">
                        {item.file.size > 0
                          ? `${Math.round((item.sentBytes / item.file.size) * 100)}%`
                          : ""}
                      </span>
                    )}
                    {item.status === "failed" && (
                      <span className="shrink-0 text-error">failed</span>
                    )}
                  </li>
                ))}
            </ul>

            {dumpFinished ? (
              <div className="mt-6 flex w-full flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void startDumpUpload()}
                  className={primaryBtnClass}
                >
                  Retry Failed Uploads
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDumpDoneCount(doneItems.length);
                    setStep("dumpSuccess");
                  }}
                  className={secondaryBtnClass}
                >
                  Finish Anyway
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort();
                }}
                className="type-caps mt-6 min-h-11 px-4 py-2 text-[0.6rem] text-ink-soft transition-colors hover:text-ink"
              >
                Cancel
              </button>
            )}
          </motion.section>
        )}

        {step === "dumpSuccess" && (
          <SuccessSection
            key="dumpSuccess"
            headingRef={headingRef}
            transition={transition}
            heading="Memories Saved"
            copy={
              dumpDoneCount === 1
                ? "One memory from the celebration is on its way to us."
                : `${dumpDoneCount} memories from the celebration are on their way to us.`
            }
            primaryLabel="Share More Memories"
            onPrimary={() => {
              resetDump();
              setStep("welcome");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LaneCard({
  title,
  copy,
  icon,
  onClick,
}: {
  title: string;
  copy: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-sm border border-line-blue bg-paper px-5 py-5 text-left transition-all duration-300 hover:border-dusty hover:bg-ice/50"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-powder bg-ice text-blue-deep transition-colors duration-300 group-hover:border-dusty">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="font-display block text-xl text-ink">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
          {copy}
        </span>
      </span>
      <svg
        viewBox="0 0 24 24"
        className="mt-4 h-4 w-4 shrink-0 text-ink-soft/60 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-blue-deep"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m9 5 7 7-7 7" />
      </svg>
    </button>
  );
}

function DumpTile({ item }: { item: DumpItem }) {
  const rejected = item.status === "rejected";
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-sm border ${
        rejected
          ? "border-error/40 opacity-60"
          : item.status === "done"
            ? "border-dusty"
            : "border-line-blue"
      } bg-ice`}
    >
      {item.previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={item.previewUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-blue-deep">
          <FilmIcon className="h-6 w-6" />
          {item.durationSeconds != null ? (
            <span className="tabular text-[0.65rem] text-ink-soft">
              {formatDuration(item.durationSeconds)}
              {formatResolution(item.width, item.height) &&
                ` · ${formatResolution(item.width, item.height)}`}
            </span>
          ) : (
            item.probing && (
              // Purely informational — the file is already queued and uploadable.
              <span className="text-[0.6rem] text-ink-soft/70">Video</span>
            )
          )}
        </div>
      )}
      {item.status === "done" && (
        <span className="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-deep text-paper-pure">
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>
      )}
      {item.note && (
        <span
          className={`absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[0.55rem] leading-tight text-paper-pure ${
            // A low-res note is advisory — the file still uploads, so it must
            // not wear the same red as a file that was turned away.
            rejected ? "bg-error/85" : "bg-ink/70"
          }`}
        >
          {item.note}
        </span>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: DumpStatus }) {
  const cls =
    status === "done"
      ? "bg-blue-deep"
      : status === "uploading"
        ? "bg-dusty motion-safe:animate-pulse"
        : status === "failed"
          ? "bg-error"
          : "bg-powder";
  return <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function ProgressRing({
  percent,
  progress,
}: {
  percent: number;
  progress: number;
}) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Upload progress"
      className="relative mt-10 h-40 w-40"
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          className="stroke-powder"
          strokeWidth="3"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          className="stroke-blue-deep transition-[stroke-dashoffset] duration-300 ease-out"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 54}
          strokeDashoffset={2 * Math.PI * 54 * (1 - progress)}
        />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center font-display text-3xl text-ink">
        {percent}%
      </span>
    </div>
  );
}

function SuccessSection({
  headingRef,
  transition,
  heading,
  copy,
  primaryLabel,
  onPrimary,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  transition: object;
  heading: string;
  copy: string;
  primaryLabel: string;
  onPrimary: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="flex flex-col items-center pt-8 text-center"
    >
      <div className="is-drawn text-dusty">
        <TatreezCluster className="h-24 w-24" />
      </div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="type-display mt-8 text-4xl text-ink outline-none md:text-5xl"
      >
        {heading}
      </h1>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
        {copy}
      </p>
      <p className="font-display mt-6 text-lg text-ink">
        Bilal Ahmad <span className="text-dusty italic">&amp;</span> Jennah
        Samhan
      </p>

      <div className="mt-10 flex w-full flex-col gap-3">
        <button type="button" onClick={onPrimary} className={primaryBtnClass}>
          {primaryLabel}
        </button>
        <Link
          href="/"
          className="type-caps flex min-h-11 w-full items-center justify-center rounded-sm border border-line-blue px-8 py-3 text-[0.62rem] text-ink-soft transition-colors duration-300 hover:border-dusty hover:text-ink"
        >
          Return to Wedding Site
        </Link>
      </div>
    </motion.section>
  );
}

function SecondaryAction({
  label,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-13 items-center justify-center gap-2.5 rounded-sm border border-line-blue bg-paper px-4 py-3 text-sm text-ink transition-colors duration-300 hover:border-dusty disabled:opacity-50"
    >
      <span className="text-blue-deep">{icon}</span>
      {label}
    </button>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M15 10.5 20 8v8l-5-2.5" />
      <rect x="3" y="6.5" width="12" height="11" rx="2" />
    </svg>
  );
}

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4" />
    </svg>
  );
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m3.5 16.5 4.5-4 3.5 3 3.5-3.5 5.5 5" />
    </svg>
  );
}

function StackIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="6.5" y="7.5" width="14" height="12" rx="2" />
      <path d="M4 15.5v-9a2 2 0 0 1 2-2h11" />
      <circle cx="11" cy="12" r="1.6" />
      <path d="m6.5 17 3.8-3.4 2.9 2.5 3-2.9 4.3 3.8" />
    </svg>
  );
}
