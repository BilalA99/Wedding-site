import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { listEntries } from "@/lib/guestbook-service";
import { loadIntegration } from "@/lib/google/tokens";
import { formatBytes } from "@/lib/guestbook-shared";

import { AdminShell } from "../AdminShell";
import { GuestbookGallery } from "./GuestbookGallery";

export const dynamic = "force-dynamic";

export default async function AdminGuestbookPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const [entries, integration] = await Promise.all([
    listEntries().catch((error) => {
      console.error("admin guestbook list failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return [];
    }),
    loadIntegration().catch(() => null),
  ]);

  const live = entries.filter((e) => e.status === "complete");
  const storageBytes = live.reduce((sum, e) => sum + (e.file_size ?? 0), 0);
  const connected =
    !!integration?.refreshToken && !integration.data.broken;

  const stats = [
    { label: "Memories", value: live.length },
    { label: "Messages", value: live.filter((e) => e.kind === "message").length },
    {
      label: "From events",
      value: live.filter((e) => e.kind === "event_media").length,
    },
    { label: "Videos", value: live.filter((e) => e.media_type === "video").length },
    { label: "Photos", value: live.filter((e) => e.media_type === "photo").length },
    { label: "Favorites", value: live.filter((e) => e.favorite).length },
    { label: "Henna", value: live.filter((e) => e.event_type === "henna").length },
    { label: "Wedding", value: live.filter((e) => e.event_type === "wedding").length },
    { label: "Storage used", value: formatBytes(storageBytes) },
  ];

  return (
    <AdminShell active="/admin/guestbook" adminEmail={admin}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="type-display text-3xl text-ivory">Guestbook</h1>
        {!connected && (
          <a
            href="/admin/integrations"
            className="type-caps rounded-full border border-thread-bright/50 px-4 py-2 text-[0.6rem] text-thread-bright"
          >
            Google Drive not connected
          </a>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="hairline rounded-sm border bg-charcoal-soft/40 px-4 py-3"
          >
            <p className="type-caps text-[0.55rem] text-sand/70">{s.label}</p>
            <p className="tabular mt-1 font-display text-2xl text-ivory">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <GuestbookGallery entries={entries} />
      </div>
    </AdminShell>
  );
}
