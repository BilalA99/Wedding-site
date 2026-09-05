import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { AdminShell } from "../AdminShell";
import { InvitationsManager } from "./InvitationsManager";

export const dynamic = "force-dynamic";

interface HouseholdRow {
  id: string;
  display_name: string;
  max_party_size: number;
  allow_plus_one: boolean;
  email: string | null;
  phone: string | null;
  invited_guests: { id: string; first_name: string; last_name: string }[];
}

export default async function AdminInvitationsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const { data } = await supabaseAdmin()
    .from("households")
    .select(
      "id, display_name, max_party_size, allow_plus_one, email, phone, invited_guests ( id, first_name, last_name )",
    )
    .order("display_name");

  const households = (data ?? []) as unknown as HouseholdRow[];

  return (
    <AdminShell active="/admin/invitations" adminEmail={admin}>
      <h1 className="type-display text-3xl text-ivory">Invitations</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ivory/60">
        The site currently runs in open RSVP mode — anyone with the link can
        respond. Build your household list here now; controlled invitation
        mode can be switched on later without any rebuild.
      </p>

      <div className="mt-8">
        <InvitationsManager
          households={households.map((h) => ({
            id: h.id,
            displayName: h.display_name,
            maxPartySize: h.max_party_size,
            allowPlusOne: h.allow_plus_one,
            email: h.email,
            phone: h.phone,
            guests: h.invited_guests.map((g) =>
              `${g.first_name} ${g.last_name}`.trim(),
            ),
          }))}
        />
      </div>
    </AdminShell>
  );
}
