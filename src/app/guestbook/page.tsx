import type { Metadata } from "next";

import { GuestbookApp } from "@/components/guestbook/GuestbookApp";
import {
  GUESTBOOK_EVENTS,
  type GuestbookEvent,
} from "@/lib/guestbook-shared";

export const metadata: Metadata = {
  title: "Leave Us a Message — Bilal Ahmad & Jennah Samhan",
  description:
    "Record a video or share a photo for Bilal & Jennah's wedding guestbook.",
  robots: { index: false, follow: false },
};

export default async function GuestbookPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  const initialEvent = GUESTBOOK_EVENTS.includes(event as GuestbookEvent)
    ? (event as GuestbookEvent)
    : null;

  return (
    <main className="min-h-dvh bg-paper">
      <GuestbookApp initialEvent={initialEvent} />
    </main>
  );
}
