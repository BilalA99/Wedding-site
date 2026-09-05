"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AUDIO_PATH } from "@/config/wedding";

interface ExperienceContextValue {
  musicPlaying: boolean;
  toggleMusic: () => void;
  audioAvailable: boolean;
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

export function useExperience(): ExperienceContextValue {
  const ctx = useContext(ExperienceContext);
  if (!ctx) throw new Error("useExperience outside ExperienceProvider");
  return ctx;
}

const TARGET_VOLUME = 0.3;

/**
 * Music behavior: the song attempts to start the moment the page mounts.
 * Where the browser blocks audible autoplay, a one-time listener starts it
 * on the visitor's first tap/click/keypress anywhere — no gate, no modal.
 * An explicit pause is remembered for the session and never overridden.
 */
export function ExperienceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const wasPlayingRef = useRef(false);
  const userPausedRef = useRef(false);

  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const el = new Audio(AUDIO_PATH);
      el.loop = true;
      el.preload = "auto";
      el.volume = 0;
      el.addEventListener("error", () => {
        setAudioAvailable(false);
        setMusicPlaying(false);
      });
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  const fadeTo = useCallback((el: HTMLAudioElement, target: number) => {
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
    const step = () => {
      const diff = target - el.volume;
      if (Math.abs(diff) < 0.01) {
        el.volume = target;
        if (target === 0) el.pause();
        return;
      }
      el.volume += diff * 0.06;
      fadeRef.current = requestAnimationFrame(step);
    };
    fadeRef.current = requestAnimationFrame(step);
  }, []);

  const playMusic = useCallback((): Promise<boolean> => {
    const el = ensureAudio();
    return el
      .play()
      .then(() => {
        setMusicPlaying(true);
        fadeTo(el, TARGET_VOLUME);
        try {
          sessionStorage.setItem("bj-music", "1");
        } catch {}
        return true;
      })
      .catch(() => false);
  }, [ensureAudio, fadeTo]);

  const pauseMusic = useCallback(() => {
    const el = audioRef.current;
    if (el) fadeTo(el, 0);
    setMusicPlaying(false);
    try {
      sessionStorage.setItem("bj-music", "0");
    } catch {}
  }, [fadeTo]);

  // Autoplay attempt + first-interaction recovery.
  useEffect(() => {
    let paused = false;
    try {
      paused = sessionStorage.getItem("bj-music") === "0";
    } catch {}
    if (paused) {
      userPausedRef.current = true;
      return;
    }

    let cleanedUp = false;
    const listeners: Array<[string, EventListener]> = [];

    const removeListeners = () => {
      for (const [type, fn] of listeners) {
        window.removeEventListener(type, fn);
      }
      listeners.length = 0;
    };

    const tryOnInteraction: EventListener = () => {
      if (cleanedUp || userPausedRef.current) {
        removeListeners();
        return;
      }
      playMusic().then((ok) => {
        if (ok) removeListeners();
      });
    };

    playMusic().then((ok) => {
      if (ok || cleanedUp) return;
      // Blocked — arm one-time recovery on any reasonable interaction.
      for (const type of ["pointerdown", "touchstart", "keydown"]) {
        window.addEventListener(type, tryOnInteraction, { passive: true });
        listeners.push([type, tryOnInteraction]);
      }
    });

    return () => {
      cleanedUp = true;
      removeListeners();
    };
  }, [playMusic]);

  const toggleMusic = useCallback(() => {
    if (musicPlaying) {
      userPausedRef.current = true;
      pauseMusic();
    } else {
      userPausedRef.current = false;
      playMusic();
    }
  }, [musicPlaying, pauseMusic, playMusic]);

  // Pause when the tab is hidden; resume when it returns (unless the
  // visitor explicitly paused).
  useEffect(() => {
    const onVisibility = () => {
      const el = audioRef.current;
      if (!el) return;
      if (document.hidden) {
        wasPlayingRef.current = !el.paused;
        el.pause();
      } else if (
        wasPlayingRef.current &&
        musicPlaying &&
        !userPausedRef.current
      ) {
        el.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [musicPlaying]);

  const value = useMemo(
    () => ({ musicPlaying, toggleMusic, audioAvailable }),
    [musicPlaying, toggleMusic, audioAvailable],
  );

  return (
    <ExperienceContext.Provider value={value}>
      {children}
    </ExperienceContext.Provider>
  );
}
