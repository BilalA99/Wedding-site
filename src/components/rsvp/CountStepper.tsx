"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { MAX_PARTY_SIZE } from "@/config/wedding";

export function CountStepper({
  value,
  onChange,
  label,
  idBase,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  idBase: string;
}) {
  const reducedMotion = useReducedMotion();

  const set = (next: number) =>
    onChange(Math.min(MAX_PARTY_SIZE, Math.max(1, next)));

  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={`${idBase}-count`} className="text-sm text-ink">
        {label}
      </label>
      <div className="flex items-center rounded-full border border-line-blue bg-paper-pure">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= 1}
          aria-label="Fewer guests"
          className="flex h-11 w-11 items-center justify-center rounded-l-full text-lg text-ink transition active:scale-90 disabled:opacity-30"
        >
          −
        </button>
        <output
          id={`${idBase}-count`}
          aria-live="polite"
          className="tabular relative block w-10 overflow-hidden text-center font-display text-xl text-blue-deep"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={value}
              className="inline-block"
              initial={reducedMotion ? {} : { y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? {} : { y: -14, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {value}
            </motion.span>
          </AnimatePresence>
        </output>
        <button
          type="button"
          onClick={() => set(value + 1)}
          disabled={value >= MAX_PARTY_SIZE}
          aria-label="More guests"
          className="flex h-11 w-11 items-center justify-center rounded-r-full text-lg text-ink transition active:scale-90 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
