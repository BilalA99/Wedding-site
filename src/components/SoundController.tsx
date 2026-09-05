"use client";

import { useExperience } from "@/components/providers/ExperienceProvider";

/**
 * Persistent floating music control with an animated waveform.
 * Hidden until the guest has entered; disappears if audio can't load.
 */
export function SoundController() {
  const { entered, musicPlaying, toggleMusic, audioAvailable } =
    useExperience();

  if (!entered || !audioAvailable) return null;

  return (
    <button
      type="button"
      onClick={toggleMusic}
      aria-label={musicPlaying ? "Pause music" : "Play music"}
      aria-pressed={musicPlaying}
      className="hairline fixed right-4 bottom-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border bg-charcoal/80 backdrop-blur-sm transition-transform duration-300 hover:scale-105 md:right-6 md:bottom-6"
      style={{
        marginBottom: "env(safe-area-inset-bottom, 0px)",
        marginRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-[2px] rounded-full bg-gold"
            style={
              musicPlaying
                ? {
                    height: "100%",
                    animation: `sound-bar 1.1s ease-in-out ${i * 0.18}s infinite`,
                    transformOrigin: "bottom",
                  }
                : { height: "35%", transformOrigin: "bottom" }
            }
          />
        ))}
      </span>
    </button>
  );
}
