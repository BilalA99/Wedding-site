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
  entered: boolean;
  enter: (withMusic: boolean) => void;
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

export function ExperienceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [entered, setEntered] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const wasPlayingRef = useRef(false);

  // Restore session preference (returning visitors skip the gate). Runs in a
  // rAF callback after hydration to avoid synchronous cascading renders.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (sessionStorage.getItem("bj-entered") === "1") setEntered(true);
      } catch {
        // storage unavailable — treat as first visit
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Scroll lock while the entrance gate is up (only after hydration so a
  // no-JS or slow-JS visitor can always scroll).
  useEffect(() => {
    if (!hydrated) return;
    document.body.dataset.scrollLocked = entered ? "false" : "true";
    if (entered) delete document.body.dataset.scrollLocked;
    return () => {
      delete document.body.dataset.scrollLocked;
    };
  }, [entered, hydrated]);

  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const el = new Audio(AUDIO_PATH);
      el.loop = true;
      el.preload = "none";
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

  const playMusic = useCallback(() => {
    const el = ensureAudio();
    el.play()
      .then(() => {
        setMusicPlaying(true);
        fadeTo(el, TARGET_VOLUME);
        try {
          sessionStorage.setItem("bj-music", "1");
        } catch {}
      })
      .catch(() => {
        setAudioAvailable(false);
        setMusicPlaying(false);
      });
  }, [ensureAudio, fadeTo]);

  const pauseMusic = useCallback(() => {
    const el = audioRef.current;
    if (el) fadeTo(el, 0);
    setMusicPlaying(false);
    try {
      sessionStorage.setItem("bj-music", "0");
    } catch {}
  }, [fadeTo]);

  const enter = useCallback(
    (withMusic: boolean) => {
      setEntered(true);
      try {
        sessionStorage.setItem("bj-entered", "1");
      } catch {}
      if (withMusic) playMusic();
    },
    [playMusic],
  );

  const toggleMusic = useCallback(() => {
    if (musicPlaying) pauseMusic();
    else playMusic();
  }, [musicPlaying, pauseMusic, playMusic]);

  // Pause when the tab is hidden; resume gracefully when it returns.
  useEffect(() => {
    const onVisibility = () => {
      const el = audioRef.current;
      if (!el) return;
      if (document.hidden) {
        wasPlayingRef.current = !el.paused;
        el.pause();
      } else if (wasPlayingRef.current && musicPlaying) {
        el.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [musicPlaying]);

  const value = useMemo(
    () => ({ entered, enter, musicPlaying, toggleMusic, audioAvailable }),
    [entered, enter, musicPlaying, toggleMusic, audioAvailable],
  );

  return (
    <ExperienceContext.Provider value={value}>
      {children}
    </ExperienceContext.Provider>
  );
}
