"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  MAX_GUEST_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_VIDEO_DURATION_SECONDS,
  VIDEO_DURATION_TOLERANCE_SECONDS,
  formatBytes,
  formatDuration,
  isAllowedMime,
  maxBytesFor,
  type GuestbookEvent,
  type GuestbookMediaType,
} from "@/lib/guestbook-shared";
import {
  makePhotoThumbnail,
  makeVideoThumbnail,
  readVideoDuration,
} from "@/components/guestbook/media";
import {
  SessionExpiredError,
  UploadAbortedError,
  uploadResumable,
  uploadSmall,
} from "@/components/guestbook/uploader";
import { TatreezCluster } from "@/components/tatreez/Tatreez";

type Step = "choose" | "details" | "uploading" | "success";

interface SelectedMedia {
  file: File;
  mediaType: GuestbookMediaType;
  previewUrl: string;
  durationSeconds: number | null;
  submissionId: string;
}

const EVENT_OPTIONS: { value: GuestbookEvent; label: string }[] = [
  { value: "henna", label: "Henna" },
  { value: "wedding", label: "Wedding" },
  { value: "general", label: "For Both" },
];

const inputClass =
  "w-full rounded-sm border border-line-blue bg-paper px-4 py-3.5 text-base text-ink placeholder:text-ink-soft/50 transition-colors duration-300 focus:border-dusty";
const labelClass = "type-caps mb-2 block text-[0.62rem] text-blue-deep";

const DRAFT_KEY = "gb_draft";

function loadDraft(): { name?: string; message?: string; event?: GuestbookEvent } {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ReturnType<typeof loadDraft>) : {};
  } catch {
    return {};
  }
}

export function GuestbookApp({
  initialEvent,
}: {
  initialEvent: GuestbookEvent | null;
}) {
  const reducedMotion = useReducedMotion();

  const [step, setStep] = useState<Step>("choose");
  const [event, setEvent] = useState<GuestbookEvent>(initialEvent ?? "general");
  const [eventChosen, setEventChosen] = useState(initialEvent != null);
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [inspecting, setInspecting] = useState(false);

  const thumbnailRef = useRef<Blob | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const recordInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Restore lightweight draft fields after hydration (never media bytes).
  // rAF avoids sync setState in an effect, same as RsvpWizard.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const draft = loadDraft();
      if (draft.name) setGuestName(draft.name);
      if (draft.message) setMessage(draft.message);
      if (!initialEvent && draft.event) {
        setEvent(draft.event);
        setEventChosen(true);
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
  useEffect(() => {
    if (step !== "uploading") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [step]);

  // Move focus to the step heading on transitions (screen-reader context).
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const releaseMedia = useCallback((m: SelectedMedia | null) => {
    if (m) URL.revokeObjectURL(m.previewUrl);
  }, []);

  useEffect(() => () => releaseMedia(media), [media, releaseMedia]);

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
      if (mediaType === "video") {
        durationSeconds = await readVideoDuration(file);
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
          submissionId: crypto.randomUUID(),
        };
      });
      setInspecting(false);
      setStep("details");
    },
    [releaseMedia],
  );

  const startUpload = useCallback(async () => {
    if (!media) return;
    setError(null);
    setProgress(0);
    setStep("uploading");

    const abort = new AbortController();
    abortRef.current = abort;

    const requestSession = async () => {
      const thumb = thumbnailRef.current;
      const res = await fetch("/api/guestbook/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: media.submissionId,
          event,
          mediaType: media.mediaType,
          fileName: media.file.name || "memory",
          mimeType: media.file.type || "application/octet-stream",
          fileSize: media.file.size,
          durationSeconds: media.durationSeconds,
          guestName: guestName || undefined,
          message: message || undefined,
          thumbnail:
            thumb && (thumb.type === "image/webp" || thumb.type === "image/jpeg")
              ? { mimeType: thumb.type, fileSize: thumb.size }
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
    };

    try {
      let session = await requestSession();

      let thumbnailFileId: string | null = null;
      if (session.thumbnailUploadUrl && thumbnailRef.current) {
        const r = await uploadSmall(
          thumbnailRef.current,
          session.thumbnailUploadUrl,
          abort.signal,
        );
        thumbnailFileId = r?.fileId ?? null;
      }

      let fileId: string | null = null;
      for (let attempt = 0; attempt < 2 && !fileId; attempt++) {
        try {
          const result = await uploadResumable(media.file, session.uploadUrl!, {
            signal: abort.signal,
            onProgress: (sent, total) =>
              setProgress(total > 0 ? sent / total : 0),
          });
          fileId = result.fileId;
        } catch (err) {
          if (err instanceof SessionExpiredError && attempt === 0) {
            // Session expired mid-upload — mint a new one and restart.
            setProgress(0);
            session = await requestSession();
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
          submissionId: media.submissionId,
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
  }, [media, event, guestName, message]);

  const resetForAnother = useCallback(() => {
    setMedia((prev) => {
      releaseMedia(prev);
      return null;
    });
    thumbnailRef.current = null;
    setProgress(0);
    setError(null);
    setStep("choose");
  }, [releaseMedia]);

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

  const percent = Math.round(progress * 100);

  return (
    <div className="mx-auto w-full max-w-md px-6 pt-24 pb-16 md:max-w-lg">
      {/* Screen-reader status announcements */}
      <p aria-live="polite" className="sr-only">
        {step === "uploading"
          ? `Uploading, ${percent} percent complete`
          : step === "success"
            ? "Your memory was saved. Thank you."
            : ""}
      </p>

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

      <AnimatePresence mode="wait" initial={false}>
        {step === "choose" && (
          <motion.section
            key="choose"
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
                onClick={() => recordInputRef.current?.click()}
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
                  Up to 2 minutes
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
              </div>
            </div>

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
                className="type-caps min-h-13 w-full rounded-sm bg-blue-deep px-8 py-4 text-[0.7rem] text-paper-pure transition-colors duration-300 hover:bg-ink"
              >
                {media.mediaType === "video" ? "Upload Message" : "Upload Photo"}
              </motion.button>
              <button
                type="button"
                onClick={resetForAnother}
                className="type-caps min-h-11 w-full rounded-sm border border-line-blue px-8 py-3 text-[0.62rem] text-ink-soft transition-colors duration-300 hover:border-dusty hover:text-ink"
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

            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label="Upload progress"
              className="relative mt-12 h-40 w-40"
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
          <motion.section
            key="success"
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
              Memory Saved
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              Thank you for leaving us a message.
            </p>
            <p className="font-display mt-6 text-lg text-ink">
              Bilal Ahmad <span className="text-dusty italic">&amp;</span>{" "}
              Jennah Samhan
            </p>

            <div className="mt-10 flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={resetForAnother}
                className="type-caps min-h-13 w-full rounded-sm bg-blue-deep px-8 py-4 text-[0.7rem] text-paper-pure transition-colors duration-300 hover:bg-ink"
              >
                Leave Another Message
              </button>
              <Link
                href="/"
                className="type-caps flex min-h-11 w-full items-center justify-center rounded-sm border border-line-blue px-8 py-3 text-[0.62rem] text-ink-soft transition-colors duration-300 hover:border-dusty hover:text-ink"
              >
                Return to Wedding Site
              </Link>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
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
