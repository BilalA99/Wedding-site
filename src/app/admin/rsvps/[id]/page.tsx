import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { findPartyById } from "@/lib/rsvp-service";
import { recentAudit } from "@/lib/admin-service";

import { AdminShell } from "../../AdminShell";
import { EditRsvpForm } from "./EditRsvpForm";

export const dynamic = "force-dynamic";

export default async function AdminRsvpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const party = await findPartyById(id);
  if (!party) notFound();

  const audit = await recentAudit(30, id);

  return (
    <AdminShell active="/admin/rsvps" adminEmail={admin}>
      <Link
        href="/admin/rsvps"
        className="type-caps text-[0.62rem] text-ivory/50 hover:text-ivory"
      >
        ← All RSVPs
      </Link>
      <h1 className="type-display mt-3 text-3xl text-ivory">
        {party.primary_name}
      </h1>
      <p className="mt-1 text-xs text-ivory/50">
        Submitted{" "}
        {new Date(party.created_at).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <EditRsvpForm party={party} />

        <section aria-labelledby="history-heading">
          <h2 id="history-heading" className="type-caps text-[0.65rem] text-sand">
            History
          </h2>
          <ol className="mt-4 flex flex-col gap-2">
            {audit.map((a) => (
              <li
                key={a.id}
                className="hairline rounded-lg border bg-charcoal-soft/40 px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gold-soft">{a.action}</span>
                  <span className="text-xs text-ivory/50">
                    {new Date(a.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ivory/60">
                  by {a.actor_type}
                  {a.actor_identifier ? ` — ${a.actor_identifier}` : ""}
                </p>
              </li>
            ))}
            {audit.length === 0 && (
              <li className="text-sm text-ivory/50">No history recorded.</li>
            )}
          </ol>
        </section>
      </div>
    </AdminShell>
  );
}
