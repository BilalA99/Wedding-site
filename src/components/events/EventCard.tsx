"use client";

import { motion, useReducedMotion } from "motion/react";

import {
  directionsUrl,
  fullAddress,
  type WeddingEvent,
} from "@/config/wedding";
import { DrawOnView } from "@/components/tatreez/DrawOnView";
import { TatreezDivider } from "@/components/tatreez/Tatreez";

const EASE = [0.22, 1, 0.36, 1] as const;

export function EventCard({
  event,
  index,
}: {
  event: WeddingEvent;
  index: number;
}) {
  const reducedMotion = useReducedMotion();
  const dayNumeral = event.date.slice(-2);
  const tinted = index % 2 === 0;

  return (
    <motion.article
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 1, ease: EASE }}
      className={`relative px-6 py-16 md:px-10 md:py-24 ${
        tinted ? "bg-ice" : "bg-paper"
      }`}
      aria-labelledby={`event-${event.slug}`}
    >
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-14">
        {/* Editorial date numeral */}
        <div className="flex items-start gap-5 md:flex-col md:gap-3">
          <span
            className="type-display text-[clamp(4.5rem,10vw,8rem)] leading-none text-mist select-none"
            style={{ fontWeight: 640 }}
            aria-hidden="true"
          >
            {dayNumeral}
          </span>
          <div className="pt-2 md:pt-0">
            <p className="type-caps text-[0.6rem] text-blue-deep">
              {event.weekday}
            </p>
            <p className="mt-1 font-display text-xl text-ink md:text-2xl">
              {event.dateLabel}
            </p>
            <p className="type-caps mt-1 text-[0.65rem] text-ink-soft">
              {event.timeLabel}
            </p>
          </div>
        </div>

        <div>
          <h3
            id={`event-${event.slug}`}
            className="type-display text-[clamp(2.2rem,6vw,3.8rem)] text-ink"
          >
            {event.name}
          </h3>

          <DrawOnView className="mt-4 w-40 text-dusty">
            <TatreezDivider className="w-full" />
          </DrawOnView>

          <div className="mt-6">
            <p className="font-display text-lg text-ink md:text-xl">
              {event.venue}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft md:text-base">
              {event.address}
              <br />
              {event.city}, {event.region} {event.postalCode}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={directionsUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              className="group type-caps inline-flex min-h-11 items-center gap-2 rounded-sm bg-blue-deep px-6 py-3 text-[0.65rem] text-paper-pure transition-colors duration-300 hover:bg-ink"
              aria-label={`Directions to ${event.venue}, ${fullAddress(event)}`}
            >
              Directions
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </a>
            <a
              href={`/api/calendar/${event.slug}`}
              className="type-caps inline-flex min-h-11 items-center gap-2 rounded-sm border border-powder px-5 py-3 text-[0.65rem] text-blue-deep transition-colors duration-300 hover:border-dusty"
            >
              Add to calendar
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
