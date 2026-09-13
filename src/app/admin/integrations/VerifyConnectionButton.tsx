"use client";

import { useState, useTransition } from "react";

import { verifyGoogleConnectionAction } from "./actions";

export function VerifyConnectionButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const r = await verifyGoogleConnectionAction();
            setResult(r.ok ? "Connection healthy." : (r.error ?? "Failed."));
          })
        }
        className="type-caps hairline rounded-full border px-5 py-2.5 text-[0.62rem] text-ivory/80 transition-colors hover:text-gold-soft disabled:opacity-40"
      >
        {pending ? "Verifying…" : "Verify Connection"}
      </button>
      {result && (
        <span aria-live="polite" className="text-xs text-ivory/60">
          {result}
        </span>
      )}
    </span>
  );
}
