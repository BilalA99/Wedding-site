"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import {
  MIN_VIDEO_SHORT_EDGE,
  formatDuration,
  formatResolution,
  isLowResolution,
} from "@/lib/guestbook-shared";
import {
  CameraDeniedError,
  openCamera,
  startRecording,
  stopStream,
  streamResolution,
  type ActiveRecording,
  type StreamResolution,
} from "@/components/guestbook/recorder";

type Phase = "starting" | "ready" | "recording" | "finishing" | "error";

interface Props {
  maxSeconds: number;
  onComplete: (file: File) => void;
  onCancel: () => void;
}

/**
 * Full-screen camera capture. Replaces `<input capture>` so the resolution is
 * ours to request rather than the OS's to choose.
 */
export function VideoRecorder({ maxSeconds, onComplete, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingRef = useRef<ActiveRecording | null>(null);
  const completedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [resolution, setResolution] = useState<StreamResolution>({
    width: null,
    height: null,
  });
  const [elapsed, setElapsed] = useState(0);

  // ---- camera lifecycle ---------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setPhase("starting");
      setErrorMessage(null);
      try {
        const stream = await openCamera(facing);
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        setResolution(streamResolution(stream));
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // iOS needs an explicit play() after a source swap.
          void videoRef.current.play().catch(() => {});
        }
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof CameraDeniedError
            ? "We need camera access to record. Please allow it in your browser settings, or choose a video from your library instead."
            : "We couldn't reach your camera. You can still choose a video from your library.",
        );
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [facing]);

  // Stop the camera for good when the recorder closes.
  useEffect(
    () => () => {
      recordingRef.current?.stop();
      stopStream(streamRef.current);
    },
    [],
  );

  // ---- recording ----------------------------------------------------------

  const finish = useCallback(
    (file: File | null) => {
      if (completedRef.current) return;
      completedRef.current = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (file) {
        onComplete(file);
      } else {
        setErrorMessage(
          "That recording didn't save. Please try again, or choose a video from your library.",
        );
        setPhase("error");
        completedRef.current = false;
      }
    },
    [onComplete],
  );

  const stop = useCallback(() => {
    if (!recordingRef.current) return;
    setPhase("finishing");
    recordingRef.current.stop();
    recordingRef.current = null;
  }, []);

  const start = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    setElapsed(0);
    setPhase("recording");
    recordingRef.current = startRecording(stream, finish);
  }, [finish]);

  // Tick the timer and hard-stop at the cap.
  useEffect(() => {
    if (phase !== "recording") return;
    const started = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsed(seconds);
      if (seconds >= maxSeconds) stop();
    }, 250);
    return () => clearInterval(timer);
  }, [phase, maxSeconds, stop]);

  const cancel = useCallback(() => {
    recordingRef.current?.stop();
    recordingRef.current = null;
    completedRef.current = true;
    stopStream(streamRef.current);
    streamRef.current = null;
    onCancel();
  }, [onCancel]);

  // ---- render -------------------------------------------------------------

  const resolutionLabel = formatResolution(resolution.width, resolution.height);
  const lowRes = isLowResolution(resolution.width, resolution.height);
  const remaining = Math.max(0, maxSeconds - elapsed);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className={`h-full w-full object-cover ${
            facing === "user" ? "scale-x-[-1]" : ""
          }`}
        />

        {phase === "starting" && (
          <p
            className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-ice"
            aria-live="polite"
          >
            Opening your camera…
          </p>
        )}

        {phase === "error" && errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80 px-8">
            <p role="alert" className="text-center text-sm text-ice">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Quality readout — the whole point of this screen. */}
        {(phase === "ready" || phase === "recording") && resolutionLabel && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2">
            <span
              className={`type-caps rounded-full px-3 py-1.5 text-[0.58rem] ${
                lowRes ? "bg-error/90 text-white" : "bg-ink/55 text-ice"
              }`}
            >
              {lowRes
                ? `Camera only offers ${resolutionLabel}`
                : `Recording in ${resolutionLabel}`}
            </span>
          </div>
        )}

        {phase === "recording" && (
          <div className="absolute top-16 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/55 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-error motion-safe:animate-pulse" />
            <span className="tabular text-xs text-ice">
              {formatDuration(elapsed)} · {formatDuration(remaining)} left
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-6 px-8 py-8">
        <button
          type="button"
          onClick={cancel}
          className="type-caps text-[0.6rem] text-ice/80 transition-colors hover:text-ice"
        >
          Cancel
        </button>

        {phase === "recording" || phase === "finishing" ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={stop}
            disabled={phase === "finishing"}
            aria-label="Stop recording"
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-ice disabled:opacity-60"
          >
            <span className="h-7 w-7 rounded-sm bg-error" />
          </motion.button>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={start}
            disabled={phase !== "ready"}
            aria-label="Start recording"
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-ice disabled:opacity-40"
          >
            <span className="h-14 w-14 rounded-full bg-error" />
          </motion.button>
        )}

        <button
          type="button"
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          disabled={phase === "recording" || phase === "finishing"}
          className="type-caps text-[0.6rem] text-ice/80 transition-colors hover:text-ice disabled:opacity-30"
        >
          Flip
        </button>
      </div>

      {phase === "ready" && lowRes && (
        <p className="px-8 pb-8 text-center text-xs text-ice/70">
          This camera tops out below {MIN_VIDEO_SHORT_EDGE}p. Try the rear
          camera with Flip — it&rsquo;s usually sharper.
        </p>
      )}
    </div>
  );
}
