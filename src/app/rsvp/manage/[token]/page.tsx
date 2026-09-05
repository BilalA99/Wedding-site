import type { Metadata } from "next";
import Link from "next/link";

import { isPlausibleToken } from "@/lib/tokens";
import { findPartyByToken } from "@/lib/rsvp-service";
import { Moon } from "@/components/Moon";

import { ManageForm } from "./ManageForm";

export const metadata: Metadata = {
  title: "Manage your RSVP — Bilal Ahmad & Jennah Samhan",
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
      <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
        <h1 className="type-display text-3xl text-ink">
          This link isn&rsquo;t valid
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">
          The management link may have been mistyped. If you can&rsquo;t find
          your original link, you can submit a fresh RSVP and we&rsquo;ll sort
          out the rest.
        </p>
        <Link
          href="/#rsvp"
          className="type-caps mt-10 inline-flex min-h-11 items-center rounded-sm bg-blue-deep px-7 py-3 text-[0.65rem] text-paper-pure transition-colors hover:bg-ink"
        >
          Go to RSVP
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-ice px-6 py-16 md:py-24">
      <div className="mx-auto max-w-xl rounded-sm border border-line-blue bg-paper-pure px-6 py-10 shadow-[0_10px_40px_rgba(39,52,63,0.06)] md:px-10 md:py-12">
        <div className="is-drawn flex justify-center text-dusty">
          <Moon className="w-10" />
        </div>
        <h1 className="type-display mt-6 text-center text-3xl text-ink md:text-4xl">
          Your RSVP
        </h1>
        <p className="mt-3 text-center text-sm text-ink-soft">
          Update your plans any time before the celebrations.
        </p>

        <div className="mt-12">
          <ManageForm token={token} party={party} />
        </div>
      </div>
    </main>
  );
}
