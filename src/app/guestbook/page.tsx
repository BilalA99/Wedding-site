import type { Metadata } from "next";

import { GuestbookApp } from "@/components/guestbook/GuestbookApp";
import {
  GUESTBOOK_EVENTS,
  type GuestbookEvent,
} from "@/lib/guestbook-shared";

const GUESTBOOK_TITLE = "Share a Memory — Bilal Ahmad & Jennah Samhan";
const GUESTBOOK_DESCRIPTION =
  "Leave Bilal & Jennah a video message, or share your photos and videos from the Henna and the Wedding — straight from your phone.";

export const metadata: Metadata = {
  title: GUESTBOOK_TITLE,
  description: GUESTBOOK_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: "Share a Memory",
    description: GUESTBOOK_DESCRIPTION,
    type: "website",
    url: "/guestbook",
    siteName: "Bilal Ahmad & Jennah Samhan",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Share a Memory",
    description: GUESTBOOK_DESCRIPTION,
  },
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
