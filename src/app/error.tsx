"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      <h1 className="type-display text-3xl text-ink">Something came undone</h1>
      <p className="mt-4 max-w-sm text-sm text-ink-soft">
        An unexpected error occurred. Your RSVP data is safe — please try
        again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="type-caps mt-10 min-h-11 rounded-sm bg-blue-deep px-7 py-3 text-[0.65rem] text-paper-pure transition-colors hover:bg-ink"
      >
        Try again
      </button>
    </main>
  );
}
