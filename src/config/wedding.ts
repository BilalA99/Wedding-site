// Single source of truth for non-secret wedding configuration.
// Event details are also seeded into the database (supabase/migrations);
// this static copy renders the public site without a database round-trip.

export const COUPLE = {
  partnerA: "Bilal Ahmad",
  partnerB: "Jennah Samhan",
  displayName: "Bilal Ahmad & Jennah Samhan",
} as const;

export const TIMEZONE = "America/New_York";

export type EventSlug = "henna" | "wedding";

export interface WeddingEvent {
  slug: EventSlug;
  name: string;
  weekday: string;
  dateLabel: string;
  /** ISO date in the event's local timezone */
  date: string;
  timeLabel: string;
  /** Event start as a fixed UTC instant (Oct 2026 is EDT, UTC-4). */
  startUtc: string;
  /** Assumed end for calendar entries. */
  endUtc: string;
  venue: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
}

export const EVENTS: readonly WeddingEvent[] = [
  {
    slug: "henna",
    name: "Henna",
    weekday: "Saturday",
    dateLabel: "October 3, 2026",
    date: "2026-10-03",
    timeLabel: "7:00 PM",
    startUtc: "2026-10-03T23:00:00Z",
    endUtc: "2026-10-04T03:00:00Z",
    venue: "Widdi Catering Hall",
    address: "5602 6th Ave",
    city: "Brooklyn",
    region: "NY",
    postalCode: "11220",
  },
  {
    slug: "wedding",
    name: "Wedding",
    weekday: "Sunday",
    dateLabel: "October 4, 2026",
    date: "2026-10-04",
    timeLabel: "7:00 PM",
    startUtc: "2026-10-04T23:00:00Z",
    endUtc: "2026-10-05T04:00:00Z",
    venue: "Hilton Garden Inn New York/Staten Island",
    address: "1100 South Ave",
    city: "Staten Island",
    region: "NY",
    postalCode: "10314",
  },
] as const;

export const EVENT_SLUGS = EVENTS.map((e) => e.slug) as EventSlug[];

export function getEvent(slug: EventSlug): WeddingEvent {
  const event = EVENTS.find((e) => e.slug === slug);
  if (!event) throw new Error(`Unknown event: ${slug}`);
  return event;
}

export function fullAddress(e: WeddingEvent): string {
  return `${e.address}, ${e.city}, ${e.region} ${e.postalCode}`;
}

export function directionsUrl(e: WeddingEvent): string {
  const q = encodeURIComponent(`${e.venue}, ${fullAddress(e)}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export function appleMapsUrl(e: WeddingEvent): string {
  const q = encodeURIComponent(`${e.venue}, ${fullAddress(e)}`);
  return `https://maps.apple.com/?daddr=${q}`;
}

/** Wedding ceremony start — countdown target. */
export const WEDDING_START_UTC = "2026-10-04T23:00:00Z";

export const MAX_PARTY_SIZE = 12;

export const AUDIO_PATH = "/audio/wedding-theme.mp3";

export const SITE_TITLE = "Bilal Ahmad & Jennah Samhan | October 2026";
export const SITE_DESCRIPTION =
  "Bilal Ahmad & Jennah Samhan are getting married. Henna — October 3, 2026, Brooklyn. Wedding — October 4, 2026, Staten Island. RSVP inside.";

export const VIDEO_PATH = "/video/hero-embroidery.mp4";
export const VIDEO_MOBILE_PATH = "/video/hero-embroidery-mobile.mp4";
export const POSTER_PATH = "/video/hero-poster.webp";
export const MONOGRAM_PATH = "/image/monogram.webp";
export const MOON_PATH = "/image/full-moon.webp";
