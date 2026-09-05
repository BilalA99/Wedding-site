import { ExperienceProvider } from "@/components/providers/ExperienceProvider";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/hero/Hero";
import { EventsSection } from "@/components/events/EventsSection";
import { RsvpSection } from "@/components/rsvp/RsvpSection";
import { SoundController } from "@/components/SoundController";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <ExperienceProvider>
      <SmoothScroll />
      <Nav />
      <main id="top">
        <Hero />
        <EventsSection />
        <RsvpSection />
      </main>
      <Footer />
      <SoundController />
    </ExperienceProvider>
  );
}
