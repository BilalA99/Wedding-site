import { redirect } from "next/navigation";
import Link from "next/link";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { recentAudit } from "@/lib/admin-service";

import { AdminShell } from "../AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const audit = await recentAudit(100);

  return (
    <AdminShell active="/admin/activity" adminEmail={admin}>
      <h1 className="type-display text-3xl text-ivory">Activity</h1>
      <p className="mt-2 text-sm text-ivory/60">
        Every guest and admin change, newest first.
      </p>

      <ol className="mt-8 flex flex-col gap-2">
        {audit.map((a) => (
          <li
            key={a.id}
            className="hairline rounded-lg border bg-charcoal-soft/40 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="text-gold-soft">{a.action}</span>
                <span className="text-ivory/60">
                  {" "}
                  · {a.actor_type}
                  {a.actor_identifier ? ` — ${a.actor_identifier}` : ""}
                </span>
              </span>
              <span className="text-xs text-ivory/50">
                {new Date(a.created_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
            {a.party_id && (
              <Link
                href={`/admin/rsvps/${a.party_id}`}
                className="type-caps mt-1 inline-block text-[0.6rem] text-ivory/50 hover:text-gold-soft"
              >
                View RSVP →
              </Link>
            )}
          </li>
        ))}
        {audit.length === 0 && (
          <li className="text-sm text-ivory/50">No activity yet.</li>
        )}
      </ol>
    </AdminShell>
  );
}
