"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

import { POSTER_PATH, VIDEO_PATH } from "@/config/wedding";

const EASE = [0.22, 1, 0.36, 1] as const;

function LineReveal({
  children,
  delay,
  className = "",
}: {
  children: React.ReactNode;
  delay: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <span className={`block overflow-hidden ${className}`}>
      <motion.span
        className="block"
        initial={
          reducedMotion
            ? { opacity: 1 }
            : { y: "60%", opacity: 0, filter: "blur(6px)" }
        }
        animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.3, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export function Hero() {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-28%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);

  const d = (t: number) => (reducedMotion ? 0 : t);

  return (
    <section
      ref={sectionRef}
      className="relative flex h-dvh min-h-[560px] flex-col items-center justify-center overflow-hidden bg-linen"
      aria-label="Bilal Ahmad and Jennah Samhan — October 2026"
    >
      {/* Hero artwork: looping embroidery video (decorative, muted).
          With reduced motion, the still poster carries the scene. */}
      <motion.div
        className="absolute inset-0"
        style={reducedMotion ? undefined : { y: videoY }}
        aria-hidden="true"
      >
        {/* Portrait phones crop the 16:9 frame to its blank center, so the
            left embroidery column is pinned into view below md. */}
        {reducedMotion ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={POSTER_PATH}
            alt=""
            className="h-full w-full object-cover object-[12%_50%] md:object-center"
          />
        ) : (
          <video
            className="h-full w-full object-cover object-[12%_50%] md:object-center"
            src={VIDEO_PATH}
            poster={POSTER_PATH}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            tabIndex={-1}
          />
        )}
        {/* Soft radial wash for name legibility — barely-there, never gray */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 62% 46% at 50% 46%, rgba(251,250,246,0.62) 0%, rgba(251,250,246,0.25) 55%, rgba(251,250,246,0) 100%)",
          }}
        />
        {/* Seam into the page below */}
        <div
          className="absolute inset-x-0 bottom-0 h-28"
          style={{
            background:
              "linear-gradient(to bottom, rgba(251,250,246,0) 0%, #fbfaf6 100%)",
          }}
        />
      </motion.div>

      <motion.div
        className="relative z-10 flex flex-col items-center px-6 text-center"
        style={reducedMotion ? undefined : { y: textY, opacity: textOpacity }}
      >
        <motion.p
          className="type-caps mb-7 text-[0.62rem] text-blue-deep md:mb-9 md:text-xs"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: d(0.5), ease: EASE }}
        >
          Together with their families
        </motion.p>

        <h1 className="type-display text-ink">
          <LineReveal
            delay={d(0.9)}
            className="text-[clamp(2.5rem,10.5vw,7.25rem)] leading-[1.06] whitespace-nowrap"
          >
            Bilal Ahmad
          </LineReveal>
          <LineReveal delay={d(1.5)} className="my-1 md:my-2">
            <span className="font-display text-[clamp(1.4rem,4.5vw,2.9rem)] text-dusty italic">
              &amp;
            </span>
          </LineReveal>
          <LineReveal
            delay={d(1.9)}
            className="text-[clamp(2.5rem,10.5vw,7.25rem)] leading-[1.06] whitespace-nowrap"
          >
            Jennah Samhan
          </LineReveal>
        </h1>

        <motion.div
          className="mt-8 flex items-center gap-4 md:mt-10"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.1, delay: d(2.6), ease: EASE }}
          aria-hidden="true"
        >
          <span className="hidden h-px w-10 bg-dusty/50 sm:block md:w-16" />
          <span className="font-sans text-[0.62rem] font-medium tracking-[0.22em] whitespace-nowrap text-ink-soft uppercase sm:tracking-[0.3em] md:text-xs">
            October 3 &ndash; 4, 2026 · New York
          </span>
          <span className="hidden h-px w-10 bg-dusty/50 sm:block md:w-16" />
        </motion.div>

        <motion.a
          href="#events"
          className="type-caps mt-12 flex flex-col items-center gap-2 text-[0.6rem] text-ink-soft transition-colors duration-300 hover:text-blue-deep md:mt-14"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: d(3.1), ease: EASE }}
        >
          <span>The celebrations</span>
          <motion.span
            aria-hidden="true"
            animate={reducedMotion ? {} : { y: [0, 5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            ↓
          </motion.span>
        </motion.a>
      </motion.div>
    </section>
  );
}
