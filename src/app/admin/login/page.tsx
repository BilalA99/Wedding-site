"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStage("code");
    setNotice("Check your inbox for a 6-digit code.");
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (err) {
      setError("That code didn't work. Please try again.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-charcoal px-6">
      <div className="hairline w-full max-w-sm rounded-xl border bg-charcoal-soft/50 p-8">
        <h1 className="type-display text-2xl text-ivory">Admin</h1>
        <p className="mt-1 text-sm text-ivory/60">Bilal &amp; Jennah</p>

        {stage === "email" ? (
          <form onSubmit={sendCode} className="mt-8 flex flex-col gap-4">
            <label
              htmlFor="admin-email"
              className="type-caps text-[0.65rem] text-sand"
            >
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="hairline w-full rounded-lg border bg-charcoal px-4 py-3 text-base text-ivory"
            />
            <button
              type="submit"
              disabled={busy}
              className="type-caps mt-2 min-h-11 rounded-full border border-gold/70 bg-gold/10 px-6 py-3 text-[0.65rem] text-gold-soft disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send sign-in code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-8 flex flex-col gap-4">
            {notice && <p className="text-sm text-ivory/70">{notice}</p>}
            <label
              htmlFor="admin-code"
              className="type-caps text-[0.65rem] text-sand"
            >
              6-digit code
            </label>
            <input
              id="admin-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="hairline w-full rounded-lg border bg-charcoal px-4 py-3 text-center font-mono text-xl tracking-[0.5em] text-ivory"
            />
            <button
              type="submit"
              disabled={busy}
              className="type-caps mt-2 min-h-11 rounded-full border border-gold/70 bg-gold/10 px-6 py-3 text-[0.65rem] text-gold-soft disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setNotice(null);
              }}
              className="type-caps min-h-9 text-[0.6rem] text-ivory/50"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-thread-bright">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
