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

  return (
    <motion.article
      initial={
        reducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 }
      }
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 1, delay: index * 0.08, ease: EASE }}
      className="relative border-t border-charcoal/15 py-14 md:py-20"
      aria-labelledby={`event-${event.slug}`}
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-14">
        {/* Editorial date numeral */}
        <div className="flex items-start gap-5 md:flex-col md:gap-3">
          <span
            className="type-display text-[clamp(4.5rem,10vw,8rem)] leading-none text-charcoal/12 select-none"
            aria-hidden="true"
          >
            {dayNumeral}
          </span>
          <div className="pt-2 md:pt-0">
            <p className="type-caps text-[0.6rem] text-thread">{event.weekday}</p>
            <p className="mt-1 font-display text-xl text-charcoal md:text-2xl">
              {event.dateLabel}
            </p>
            <p className="type-caps mt-1 text-[0.65rem] text-olive-soft">
              {event.timeLabel}
            </p>
          </div>
        </div>

        <div>
          <h3
            id={`event-${event.slug}`}
            className="type-display text-[clamp(2.2rem,6vw,3.8rem)] text-charcoal"
          >
            {event.name}
          </h3>

          <DrawOnView className="mt-4 w-40 text-thread/60">
            <TatreezDivider className="w-full" />
          </DrawOnView>

          <div className="mt-6">
            <p className="font-display text-lg text-charcoal md:text-xl">
              {event.venue}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-charcoal/70 md:text-base">
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
              className="group type-caps inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/25 px-6 py-3 text-[0.65rem] text-charcoal transition-colors duration-300 hover:border-thread hover:text-thread"
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
              className="type-caps inline-flex min-h-11 items-center gap-2 px-4 py-3 text-[0.65rem] text-charcoal/60 transition-colors duration-300 hover:text-thread"
            >
              Add to calendar
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
