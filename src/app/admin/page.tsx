import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { getEventSummaries } from "@/lib/rsvp-service";
import { listParties, recentAudit } from "@/lib/admin-service";
import { EVENTS } from "@/config/wedding";

import { AdminShell } from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const [summaries, parties, audit] = await Promise.all([
    getEventSummaries(),
    listParties(),
    recentAudit(8),
  ]);

  const bothEvents = parties.filter(
    (p) => p.responses.henna?.attending && p.responses.wedding?.attending,
  ).length;

  return (
    <AdminShell active="/admin" adminEmail={admin}>
      <h1 className="type-display text-3xl text-ivory">Overview</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="RSVP submissions" value={parties.length} />
        {EVENTS.map((event) => {
          const s = summaries.find((x) => x.slug === event.slug);
          return (
            <StatCard
              key={event.slug}
              label={`${event.name} — guests attending`}
              value={s?.guests_attending ?? 0}
              sub={`${s?.parties_attending ?? 0} parties · ${s?.parties_declined ?? 0} declined`}
            />
          );
        })}
        <StatCard label="Attending both events" value={bothEvents} />
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="type-caps text-[0.65rem] text-sand">
            Recently updated
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {parties.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/rsvps/${p.id}`}
                  className="hairline flex items-center justify-between rounded-lg border bg-charcoal-soft/40 px-4 py-3 transition-colors hover:border-gold/40"
                >
                  <span className="text-sm text-ivory">{p.primary_name}</span>
                  <span className="text-xs text-ivory/50">
                    {new Date(p.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </Link>
              </li>
            ))}
            {parties.length === 0 && (
              <li className="text-sm text-ivory/50">No RSVPs yet.</li>
            )}
          </ul>
        </section>

        <section aria-labelledby="activity-heading">
          <h2
            id="activity-heading"
            className="type-caps text-[0.65rem] text-sand"
          >
            Latest activity
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {audit.map((a) => (
              <li
                key={a.id}
                className="hairline rounded-lg border bg-charcoal-soft/40 px-4 py-3 text-sm"
              >
                <span className="text-gold-soft">{a.action}</span>
                <span className="text-ivory/60">
                  {" "}
                  · {a.actor_type}
                  {a.actor_identifier ? ` (${a.actor_identifier})` : ""} ·{" "}
                  {new Date(a.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
            {audit.length === 0 && (
              <li className="text-sm text-ivory/50">No activity yet.</li>
            )}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="hairline rounded-xl border bg-charcoal-soft/40 p-5">
      <p className="type-caps text-[0.6rem] text-sand/80">{label}</p>
      <p className="type-display tabular mt-2 text-4xl text-ivory">{value}</p>
      {sub && <p className="mt-1 text-xs text-ivory/50">{sub}</p>}
    </div>
  );
}
