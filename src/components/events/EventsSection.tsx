import { EVENTS } from "@/config/wedding";
import { Countdown } from "@/components/Countdown";
import { DrawOnView } from "@/components/tatreez/DrawOnView";
import { TatreezCypress } from "@/components/tatreez/Tatreez";

import { EventCard } from "./EventCard";

export function EventsSection() {
  return (
    <section
      id="events"
      className="relative bg-ivory px-6 py-(--spacing-section) md:px-10"
      aria-label="Wedding events"
    >
      {/* Thread continues from the hero into this section */}
      <div
        className="absolute top-0 left-1/2 h-16 w-px -translate-x-1/2 bg-linear-to-b from-sand/60 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-4xl">
        <header className="mb-4 text-center">
          <DrawOnView className="mx-auto mb-6 flex w-10 justify-center text-olive/50">
            <TatreezCypress className="w-4" />
          </DrawOnView>
          <p className="type-caps text-[0.65rem] text-thread">
            Two celebrations
          </p>
          <h2 className="type-display mt-3 text-[clamp(2rem,6vw,3.4rem)] text-charcoal">
            The Celebrations
          </h2>
          <div className="mt-10">
            <Countdown />
          </div>
        </header>

        <div className="mt-12">
          {EVENTS.map((event, i) => (
            <EventCard key={event.slug} event={event} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
