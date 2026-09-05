"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { useExperience } from "@/components/providers/ExperienceProvider";
import { TatreezCorner, TatreezDivider } from "@/components/tatreez/Tatreez";

const StitchField = dynamic(() => import("./StitchField"), { ssr: false });

const EASE = [0.22, 1, 0.36, 1] as const;

function NameReveal({
  text,
  delay,
  className,
}: {
  text: string;
  delay: number;
  className?: string;
}) {
  return (
    <span className={`inline-block overflow-hidden ${className ?? ""}`}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ y: "110%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          transition={{ duration: 1.1, delay: delay + i * 0.055, ease: EASE }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

export function Hero() {
  const { entered, enter } = useExperience();
  const reducedMotion = useReducedMotion();
  const [webglOk, setWebglOk] = useState(false);
  const [particleCount, setParticleCount] = useState(0);

  // Detect WebGL support and pick a particle budget for the device.
  // Runs in a rAF callback so hydration completes before any state change.
  useEffect(() => {
    if (reducedMotion) return;
    const id = requestAnimationFrame(() => {
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!gl) return;
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        const memory =
          (navigator as Navigator & { deviceMemory?: number }).deviceMemory ??
          4;
        setParticleCount(coarse ? (memory <= 4 ? 60 : 90) : 220);
        setWebglOk(true);
      } catch {
        // fall back to the static hero
      }
    });
    return () => cancelAnimationFrame(id);
  }, [reducedMotion]);

  // With reduced motion, everything is immediately present.
  const d = (t: number) => (reducedMotion ? 0 : t);

  return (
    <section
      className="relative flex h-dvh min-h-[540px] flex-col items-center justify-center overflow-hidden bg-charcoal"
      aria-label="Bilal and Jennah — October 2026"
    >
      {/* Depth field */}
      {webglOk && particleCount > 0 && (
        <StitchField particleCount={particleCount} />
      )}

      {/* Vignette for typography legibility */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(23,20,15,0.7) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Tatreez frame corners */}
      <div className="is-drawn pointer-events-none absolute inset-4 text-sand/50 md:inset-8">
        <TatreezCorner className="absolute top-0 left-0 w-10 md:w-14" />
        <TatreezCorner className="absolute top-0 right-0 w-10 scale-x-[-1] md:w-14" />
        <TatreezCorner className="absolute bottom-0 left-0 w-10 scale-y-[-1] md:w-14" />
        <TatreezCorner className="absolute right-0 bottom-0 w-10 scale-[-1] md:w-14" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <motion.p
          className="type-caps mb-6 text-[0.65rem] text-sand/80 md:mb-8 md:text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: d(0.4), ease: EASE }}
        >
          Together with their families
        </motion.p>

        <h1 className="type-display text-ivory">
          <NameReveal
            text="BILAL"
            delay={d(0.9)}
            className="text-[clamp(3rem,14vw,7.5rem)] tracking-[0.08em]"
          />
          <motion.span
            className="block font-display text-[clamp(1.6rem,6vw,3.2rem)] text-gold-soft italic"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: d(1.5), ease: EASE }}
          >
            &amp;
          </motion.span>
          <NameReveal
            text="JENNAH"
            delay={d(1.8)}
            className="text-[clamp(3rem,14vw,7.5rem)] tracking-[0.08em]"
          />
        </h1>

        <motion.div
          className="is-drawn mt-7 w-48 text-sand/70 md:mt-9 md:w-60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: d(2.4), ease: EASE }}
        >
          <TatreezDivider className="w-full" />
        </motion.div>

        <motion.p
          className="type-caps mt-7 text-xs text-ivory/85 md:mt-9 md:text-sm"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: d(2.7), ease: EASE }}
        >
          October 3 &ndash; 4, 2026 · New York
        </motion.p>

        {/* Entrance choices — available early; no forced waiting */}
        {!entered ? (
          <motion.div
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 md:mt-12"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: d(1.2), ease: EASE }}
          >
            <button
              type="button"
              onClick={() => enter(true)}
              className="group hairline type-caps relative min-h-11 rounded-full border px-7 py-3 text-[0.65rem] text-ivory transition-colors duration-300 hover:border-gold/60 hover:text-gold-soft"
            >
              Enter with music
            </button>
            <button
              type="button"
              onClick={() => enter(false)}
              className="type-caps min-h-11 px-4 py-3 text-[0.65rem] text-ivory/60 transition-colors duration-300 hover:text-ivory"
            >
              Enter quietly
            </button>
          </motion.div>
        ) : (
          <motion.a
            href="#events"
            className="type-caps mt-12 flex flex-col items-center gap-2 text-[0.6rem] text-sand/70 transition-colors hover:text-gold-soft"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <span>The celebrations</span>
            <motion.span
              aria-hidden="true"
              animate={reducedMotion ? {} : { y: [0, 6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              ↓
            </motion.span>
          </motion.a>
        )}
      </div>
    </section>
  );
}
