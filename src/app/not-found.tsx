import Link from "next/link";

import { TatreezStar } from "@/components/tatreez/Tatreez";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-charcoal px-6 text-center">
      <div className="is-drawn flex justify-center text-gold/60">
        <TatreezStar className="w-12" />
      </div>
      <h1 className="type-display mt-8 text-4xl text-ivory">
        This page slipped a stitch
      </h1>
      <p className="mt-4 text-sm text-ivory/60">
        The page you&rsquo;re looking for doesn&rsquo;t exist.
      </p>
      <Link
        href="/"
        className="type-caps hairline mt-10 inline-flex min-h-11 items-center rounded-full border px-7 py-3 text-[0.65rem] text-ivory transition-colors hover:border-gold/60 hover:text-gold-soft"
      >
        Back to the celebration
      </Link>
    </main>
  );
}
