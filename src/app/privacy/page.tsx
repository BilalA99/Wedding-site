import type { Metadata } from "next";

import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy — Bilal Ahmad & Jennah Samhan",
  description:
    "How Bilal & Jennah's wedding site and private guestbook handle your photos, videos, and details.",
  robots: { index: false, follow: false },
};

const CONTACT_EMAIL = "bilalactuallyexists@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-paper">
      <article className="mx-auto max-w-2xl px-6 pt-24 pb-20">
        <p className="type-caps text-[0.6rem] text-blue-deep">
          Bilal Ahmad &amp; Jennah Samhan
        </p>
        <h1 className="type-display mt-2 text-4xl text-ink">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          This website is a private wedding site for family and friends. This
          page explains, in plain English, what happens to anything you share
          here.
        </p>

        <Section title="The guestbook">
          <p>
            The guestbook lets guests record or upload videos and photos as
            messages for us. Everything you upload is stored privately in a
            Google Drive folder owned by Bilal&apos;s personal Google account.
            Nothing is posted publicly, and only we (the couple) can view,
            download, or delete guestbook uploads.
          </p>
        </Section>

        <Section title="How Google Drive is used">
          <p>
            The site connects to Bilal&apos;s Google Drive using Google&apos;s
            sign-in for the site owners only, with the limited{" "}
            <code className="text-[0.85em]">drive.file</code> permission — the
            site can only see files and folders it created itself, never the
            rest of the Drive. Google security tokens are kept on the server
            and are never sent to your browser.
          </p>
          <p>
            Guests never sign in to Google, are never asked for a Google
            account, and never receive access to the Drive folder. Uploads
            travel from your device to Google Drive over an encrypted
            connection.
          </p>
          <p>
            Our use of information received from Google APIs follows the{" "}
            <a
              className="underline decoration-powder underline-offset-2 hover:text-ink"
              href="https://developers.google.com/terms/api-services-user-data-policy"
            >
              Google API Services User Data Policy
            </a>
            , including its Limited Use requirements.
          </p>
        </Section>

        <Section title="What we store">
          <p>
            Alongside the media itself, we store lightweight details in our
            database: the name you optionally give, an optional short message,
            which event the memory is for, and technical details such as the
            file size and upload time. RSVP details you submit elsewhere on
            the site are stored the same way.
          </p>
        </Section>

        <Section title="What we never do">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>We do not sell anything you share.</li>
            <li>We do not use your media or details for advertising.</li>
            <li>
              We do not share your media with third parties unrelated to
              running this site.
            </li>
          </ul>
        </Section>

        <Section title="Deletion">
          <p>
            We may remove any upload. If you would like something you shared
            to be deleted, email{" "}
            <a
              className="underline decoration-powder underline-offset-2 hover:text-ink"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and we will take it down.
          </p>
        </Section>
      </article>
      <Footer />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}
