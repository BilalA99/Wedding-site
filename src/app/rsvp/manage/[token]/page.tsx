import type { Metadata } from "next";
import Link from "next/link";

import { isPlausibleToken } from "@/lib/tokens";
import { findPartyByToken } from "@/lib/rsvp-service";
import { TatreezStar } from "@/components/tatreez/Tatreez";

import { ManageForm } from "./ManageForm";

export const metadata: Metadata = {
  title: "Manage your RSVP — Bilal & Jennah",
  robots: { index: false, follow: false },
};

export default async function ManageRsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const party = isPlausibleToken(token)
    ? await findPartyByToken(token).catch(() => null)
    : null;

  if (!party) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-charcoal px-6 text-center">
        <h1 className="type-display text-3xl text-ivory">
          This link isn&rsquo;t valid
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-ivory/60">
          The management link may have been mistyped. If you can&rsquo;t find
          your original link, you can submit a fresh RSVP and we&rsquo;ll sort
          out the rest.
        </p>
        <Link
          href="/#rsvp"
          className="type-caps hairline mt-10 inline-flex min-h-11 items-center rounded-full border px-7 py-3 text-[0.65rem] text-ivory transition-colors hover:border-gold/60 hover:text-gold-soft"
        >
          Go to RSVP
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-charcoal px-6 py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        <div className="is-drawn flex justify-center text-gold/60">
          <TatreezStar className="w-10" />
        </div>
        <h1 className="type-display mt-6 text-center text-3xl text-ivory md:text-4xl">
          Your RSVP
        </h1>
        <p className="mt-3 text-center text-sm text-ivory/60">
          Update your plans any time before the celebrations.
        </p>

        <div className="mt-12">
          <ManageForm token={token} party={party} />
        </div>
      </div>
    </main>
  );
}
