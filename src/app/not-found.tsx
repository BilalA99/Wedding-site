import Link from "next/link";

import { TatreezStar } from "@/components/tatreez/Tatreez";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      <div className="is-drawn flex justify-center text-dusty">
        <TatreezStar className="w-12" />
      </div>
      <h1 className="type-display mt-8 text-4xl text-ink">
        This page slipped a stitch
      </h1>
      <p className="mt-4 text-sm text-ink-soft">
        The page you&rsquo;re looking for doesn&rsquo;t exist.
      </p>
      <Link
        href="/"
        className="type-caps mt-10 inline-flex min-h-11 items-center rounded-sm bg-blue-deep px-7 py-3 text-[0.65rem] text-paper-pure transition-colors hover:bg-ink"
      >
        Back to the celebration
      </Link>
    </main>
  );
}
