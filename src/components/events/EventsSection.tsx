import { EVENTS } from "@/config/wedding";
import { Countdown } from "@/components/Countdown";
import { DrawOnView } from "@/components/tatreez/DrawOnView";
import { Moon } from "@/components/Moon";

import { EventCard } from "./EventCard";

export function EventsSection() {
  return (
    <section id="events" className="relative bg-paper" aria-label="Wedding events">
      {/* Thread continues from the hero into this section */}
      <div
        className="absolute top-0 left-1/2 h-20 w-px -translate-x-1/2 bg-linear-to-b from-mist to-transparent"
        aria-hidden="true"
      />

      <header className="px-6 pt-(--spacing-section) pb-14 text-center md:pb-16">
        <DrawOnView className="mx-auto mb-6 flex justify-center text-dusty">
          <Moon className="w-9" />
        </DrawOnView>
        <p className="type-caps text-[0.65rem] text-blue-deep">
          Two celebrations
        </p>
        <h2 className="type-display mt-3 text-[clamp(2rem,6vw,3.4rem)] text-ink">
          The Celebrations
        </h2>
        <div className="mt-10">
          <Countdown />
        </div>
      </header>

      <div>
        {EVENTS.map((event, i) => (
          <EventCard key={event.slug} event={event} index={i} />
        ))}
      </div>
    </section>
  );
}
