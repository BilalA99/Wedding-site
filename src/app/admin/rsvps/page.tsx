import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/supabase/server-auth";
import {
  findDuplicateGroups,
  listParties,
  type AdminPartyRow,
} from "@/lib/admin-service";

import { AdminShell } from "../AdminShell";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "henna-yes", label: "Henna attending" },
  { key: "wedding-yes", label: "Wedding attending" },
  { key: "both", label: "Both events" },
  { key: "henna-no", label: "Henna declined" },
  { key: "wedding-no", label: "Wedding declined" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function applyFilter(parties: AdminPartyRow[], filter: FilterKey) {
  switch (filter) {
    case "henna-yes":
      return parties.filter((p) => p.responses.henna?.attending);
    case "wedding-yes":
      return parties.filter((p) => p.responses.wedding?.attending);
    case "both":
      return parties.filter(
        (p) => p.responses.henna?.attending && p.responses.wedding?.attending,
      );
    case "henna-no":
      return parties.filter((p) => p.responses.henna?.attending === false);
    case "wedding-no":
      return parties.filter((p) => p.responses.wedding?.attending === false);
    default:
      return parties;
  }
}

export default async function AdminRsvpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; dupes?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const { q = "", filter = "all", dupes } = await searchParams;
  const activeFilter = (
    FILTERS.some((f) => f.key === filter) ? filter : "all"
  ) as FilterKey;

  const all = await listParties();
  const search = q.trim().toLowerCase();

  let rows = applyFilter(all, activeFilter);
  if (search) {
    rows = rows.filter(
      (p) =>
        p.primary_name.toLowerCase().includes(search) ||
        (p.email ?? "").toLowerCase().includes(search) ||
        (p.phone ?? "").includes(search) ||
        p.member_names.some((n) => n.toLowerCase().includes(search)),
    );
  }

  const duplicateGroups = dupes === "1" ? findDuplicateGroups(all) : [];

  return (
    <AdminShell active="/admin/rsvps" adminEmail={admin}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="type-display text-3xl text-ivory">RSVPs</h1>
        <Link
          href={dupes === "1" ? "/admin/rsvps" : "/admin/rsvps?dupes=1"}
          className="type-caps hairline rounded-full border px-4 py-2 text-[0.62rem] text-ivory/70 hover:text-gold-soft"
        >
          {dupes === "1" ? "Hide duplicates" : "Possible duplicates"}
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap items-center gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone…"
          aria-label="Search RSVPs"
          className="hairline min-w-56 flex-1 rounded-full border bg-charcoal-soft/50 px-5 py-2.5 text-sm text-ivory placeholder:text-ivory/30"
        />
        <input type="hidden" name="filter" value={activeFilter} />
        <button
          type="submit"
          className="type-caps min-h-10 rounded-full border border-gold/50 px-5 py-2 text-[0.62rem] text-gold-soft"
        >
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/rsvps?filter=${f.key}${search ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`type-caps rounded-full px-4 py-2 text-[0.6rem] transition-colors ${
              activeFilter === f.key
                ? "bg-gold/15 text-gold-soft"
                : "text-ivory/50 hover:text-ivory"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {duplicateGroups.length > 0 && (
        <section className="mt-8" aria-label="Possible duplicates">
          <h2 className="type-caps text-[0.65rem] text-thread-bright">
            Possible duplicates ({duplicateGroups.length} groups)
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {duplicateGroups.map((g) => (
              <div
                key={`${g.reason}-${g.key}`}
                className="rounded-lg border border-thread/40 bg-thread/5 p-4"
              >
                <p className="text-xs text-ivory/60">
                  Matching {g.reason}: <span className="text-ivory">{g.key}</span>
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {g.parties.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/admin/rsvps/${p.id}`}
                        className="hairline inline-block rounded-full border px-4 py-1.5 text-sm text-ivory hover:border-gold/50"
                      >
                        {p.primary_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      {dupes === "1" && duplicateGroups.length === 0 && (
        <p className="mt-8 text-sm text-ivory/50">No likely duplicates found.</p>
      )}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="type-caps border-b border-ivory/15 text-[0.6rem] text-sand/80">
              <th className="py-3 pr-4">Name</th>
              <th className="py-3 pr-4">Henna</th>
              <th className="py-3 pr-4">Wedding</th>
              <th className="py-3 pr-4">Contact</th>
              <th className="py-3 pr-4">Updated</th>
              <th className="py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-b border-ivory/8 text-ivory/85 hover:bg-charcoal-soft/40"
              >
                <td className="py-3 pr-4 font-medium text-ivory">
                  {p.primary_name}
                  {p.member_names.length > 0 && (
                    <span className="block text-xs font-normal text-ivory/45">
                      {p.member_names.join(", ")}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <StatusPill response={p.responses.henna} />
                </td>
                <td className="py-3 pr-4">
                  <StatusPill response={p.responses.wedding} />
                </td>
                <td className="py-3 pr-4 text-xs text-ivory/60">
                  {p.email && <span className="block">{p.email}</span>}
                  {p.phone && <span className="block">{p.phone}</span>}
                </td>
                <td className="py-3 pr-4 text-xs text-ivory/60">
                  {new Date(p.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/rsvps/${p.id}`}
                    className="type-caps text-[0.6rem] text-gold-soft hover:text-gold"
                  >
                    View / edit
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ivory/50">
                  No RSVPs match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function StatusPill({
  response,
}: {
  response: { attending: boolean; party_size: number } | undefined;
}) {
  if (!response) {
    return <span className="text-xs text-ivory/30">—</span>;
  }
  return response.attending ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-olive/30 px-3 py-1 text-xs text-ivory">
      Yes · {response.party_size}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-thread/20 px-3 py-1 text-xs text-ivory/70">
      Declined
    </span>
  );
}
