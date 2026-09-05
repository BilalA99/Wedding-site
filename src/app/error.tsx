"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-charcoal px-6 text-center">
      <h1 className="type-display text-3xl text-ivory">
        Something came undone
      </h1>
      <p className="mt-4 max-w-sm text-sm text-ivory/60">
        An unexpected error occurred. Your RSVP data is safe — please try
        again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="type-caps hairline mt-10 min-h-11 rounded-full border px-7 py-3 text-[0.65rem] text-ivory transition-colors hover:border-gold/60 hover:text-gold-soft"
      >
        Try again
      </button>
    </main>
  );
}
