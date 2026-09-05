"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Username + password sign-in. Each username maps to an internal Supabase
 * Auth account; only accounts on the server-side ADMIN_EMAILS allow-list
 * can pass the middleware, so credentials alone gate access.
 */
const USERNAME_ACCOUNTS: Record<string, string> = {
  bilala: "bilala@admins.bilaljennah.wedding",
  jennahs: "jennahs@admins.bilaljennah.wedding",
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const email = USERNAME_ACCOUNTS[username.trim().toLowerCase()];
    if (!email) {
      setBusy(false);
      setError("Username or password is incorrect.");
      return;
    }

    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (err) {
      setError("Username or password is incorrect.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-charcoal px-6">
      <div className="hairline w-full max-w-sm rounded-xl border bg-charcoal-soft/50 p-8">
        <h1 className="type-display text-2xl text-ivory">Admin</h1>
        <p className="mt-1 text-sm text-ivory/60">
          Bilal Ahmad &amp; Jennah Samhan
        </p>

        <form onSubmit={signIn} className="mt-8 flex flex-col gap-4">
          <div>
            <label
              htmlFor="admin-username"
              className="type-caps mb-2 block text-[0.65rem] text-sand"
            >
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="hairline w-full rounded-lg border bg-charcoal px-4 py-3 text-base text-ivory"
            />
          </div>
          <div>
            <label
              htmlFor="admin-password"
              className="type-caps mb-2 block text-[0.65rem] text-sand"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="hairline w-full rounded-lg border bg-charcoal px-4 py-3 text-base text-ivory"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="type-caps mt-2 min-h-11 rounded-full border border-gold/70 bg-gold/10 px-6 py-3 text-[0.65rem] text-gold-soft disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-sm text-thread-bright">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
