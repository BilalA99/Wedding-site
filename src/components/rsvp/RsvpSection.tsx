"use client";

import { motion, useReducedMotion } from "motion/react";

import { RsvpWizard } from "./RsvpWizard";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The thread arrives here and becomes the seam of an opening invitation:
 * a powder-blue chevron over white paper, and the wizard as the sheet.
 */
export function RsvpSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section
      id="rsvp"
      className="relative overflow-hidden bg-ice px-6 py-(--spacing-section) md:px-10"
      aria-label="RSVP"
    >
      {/* Seam thread entering the section */}
      <div
        className="absolute top-0 left-1/2 h-14 w-px -translate-x-1/2 bg-linear-to-b from-mist to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          {/* Envelope flap: chevron drawn from the seam */}
          <motion.svg
            viewBox="0 0 120 28"
            className="mx-auto w-28 text-dusty"
            fill="none"
            aria-hidden="true"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <motion.path
              d="M2 2 L60 26 L118 2"
              stroke="currentColor"
              strokeWidth="1.25"
              pathLength={1}
              initial={reducedMotion ? {} : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ duration: 1.4, ease: EASE }}
            />
          </motion.svg>

          <motion.p
            className="type-caps mt-6 text-[0.65rem] text-blue-deep"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
          >
            Kindly reply
          </motion.p>
          <motion.h2
            className="type-display mt-3 text-[clamp(2rem,6vw,3.4rem)] text-ink"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
          >
            Will you join us?
          </motion.h2>
        </header>

        {/* The invitation sheet */}
        <motion.div
          className="mt-12 rounded-sm border border-line-blue bg-paper-pure px-6 py-10 shadow-[0_10px_40px_rgba(39,52,63,0.06)] md:px-12 md:py-14"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 1, delay: 0.3, ease: EASE }}
        >
          <RsvpWizard />
        </motion.div>
      </div>
    </section>
  );
}
