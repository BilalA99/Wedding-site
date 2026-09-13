import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { loadIntegration } from "@/lib/google/tokens";

import { AdminShell } from "../AdminShell";
import { VerifyConnectionButton } from "./VerifyConnectionButton";

export const dynamic = "force-dynamic";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${user.slice(0, 2)}${"•".repeat(Math.max(2, user.length - 2))}@${domain}`;
}

const CALLBACK_ERRORS: Record<string, string> = {
  denied: "Google reported the connection was declined.",
  state: "The sign-in attempt could not be verified. Please try again.",
  scope: "The Drive permission was not granted. Please approve Drive access.",
  norefresh:
    "Google did not issue an offline token. Please try connecting again.",
  exchange: "Connecting to Google failed. Please try again.",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const [{ data, refreshToken }, params] = await Promise.all([
    loadIntegration().catch(() => ({
      data: {} as Awaited<ReturnType<typeof loadIntegration>>["data"],
      refreshToken: null,
    })),
    searchParams,
  ]);

  const connected = !!refreshToken && !data.broken;
  const callbackError = params.error ? CALLBACK_ERRORS[params.error] : null;

  return (
    <AdminShell active="/admin/integrations" adminEmail={admin}>
      <h1 className="type-display text-3xl text-ivory">Integrations</h1>

      {params.connected && (
        <p className="mt-6 rounded-sm border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold-soft">
          Google Drive connected successfully.
        </p>
      )}
      {callbackError && (
        <p className="mt-6 rounded-sm border border-thread-bright/40 bg-thread/15 px-4 py-3 text-sm text-thread-bright">
          {callbackError}
        </p>
      )}

      <section className="hairline mt-8 max-w-2xl rounded-sm border bg-charcoal-soft/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ivory">Google Drive</h2>
          <span
            className={`type-caps rounded-full px-3 py-1 text-[0.55rem] ${
              connected
                ? "bg-gold/15 text-gold-soft"
                : "bg-thread/20 text-thread-bright"
            }`}
          >
            {connected ? "Connected" : data.broken ? "Needs reconnect" : "Not connected"}
          </span>
        </div>
        <p className="mt-2 text-sm text-ivory/55">
          Guestbook videos and photos upload directly into a private folder in
          this Google Drive. Guests never see or touch Drive.
        </p>

        <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="type-caps text-[0.55rem] text-sand/70">Account</dt>
            <dd className="mt-1 text-ivory/85">
              {data.accountEmail ? maskEmail(data.accountEmail) : "—"}
            </dd>
          </div>
          <div>
            <dt className="type-caps text-[0.55rem] text-sand/70">Root folder</dt>
            <dd className="mt-1 text-ivory/85">{data.rootFolderName ?? "—"}</dd>
          </div>
          <div>
            <dt className="type-caps text-[0.55rem] text-sand/70">Connected</dt>
            <dd className="mt-1 text-ivory/85">
              {data.connectedAt
                ? new Date(data.connectedAt).toLocaleString("en-US")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="type-caps text-[0.55rem] text-sand/70">Last verified</dt>
            <dd className="mt-1 text-ivory/85">
              {data.lastVerifiedAt
                ? new Date(data.lastVerifiedAt).toLocaleString("en-US")
                : "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="/api/google/oauth/start"
            className="type-caps rounded-full bg-gold/20 px-5 py-2.5 text-[0.62rem] text-gold-soft transition-colors hover:bg-gold/30"
          >
            {connected ? "Reconnect" : "Connect Google Drive"}
          </a>
          {connected && <VerifyConnectionButton />}
        </div>
      </section>
    </AdminShell>
  );
}
