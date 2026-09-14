import type { Metadata } from "next";

import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms — Bilal Ahmad & Jennah Samhan",
  description:
    "House rules for Bilal & Jennah's wedding site and private guestbook.",
  robots: { index: false, follow: false },
};

const CONTACT_EMAIL = "bilalactuallyexists@gmail.com";

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-paper">
      <article className="mx-auto max-w-2xl px-6 pt-24 pb-20">
        <p className="type-caps text-[0.6rem] text-blue-deep">
          Bilal Ahmad &amp; Jennah Samhan
        </p>
        <h1 className="type-display mt-2 text-4xl text-ink">Terms</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          This is a personal, private wedding website — not a commercial
          service. By using it, you agree to the following.
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink-soft">
          <Term title="Share only what's yours">
            Upload only photos, videos, and messages you have the right to
            share, and that the people in them would be comfortable sharing
            with us.
          </Term>
          <Term title="Keep it kind">
            Do not upload anything abusive, unlawful, or intended to hurt
            someone. This is a wedding guestbook.
          </Term>
          <Term title="We curate the guestbook">
            We may remove or decline any upload at our discretion, without
            notice.
          </Term>
          <Term title="Private by default">
            Guestbook uploads are for private viewing by us unless we
            personally choose to share a memory with family and friends.
          </Term>
          <Term title="No guarantees">
            This site is run by two people planning a wedding. We do our best,
            but availability isn&apos;t guaranteed and features may change or
            go away.
          </Term>
          <Term title="Questions">
            Reach us at{" "}
            <a
              className="underline decoration-powder underline-offset-2 hover:text-ink"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </Term>
        </div>
      </article>
      <Footer />
    </main>
  );
}

function Term({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
