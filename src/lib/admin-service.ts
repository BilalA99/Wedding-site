import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EventSlug } from "@/config/wedding";

export interface AdminPartyRow {
  id: string;
  primary_name: string;
  normalized_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
  responses: Record<
    EventSlug,
    { attending: boolean; party_size: number } | undefined
  >;
  member_names: string[];
}

interface RawParty {
  id: string;
  primary_name: string;
  normalized_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
  party_event_responses: {
    attending: boolean;
    party_size: number;
    events: { slug: string } | null;
  }[];
  party_members: { name: string }[];
}

export async function listParties(): Promise<AdminPartyRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("rsvp_parties")
    .select(
      `id, primary_name, normalized_name, email, phone, message, created_at, updated_at,
       party_event_responses ( attending, party_size, events ( slug ) ),
       party_members ( name )`,
    )
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listParties failed: ${error.message}`);

  return ((data ?? []) as unknown as RawParty[]).map((p) => {
    const responses: AdminPartyRow["responses"] = {
      henna: undefined,
      wedding: undefined,
    };
    for (const r of p.party_event_responses) {
      const slug = r.events?.slug as EventSlug | undefined;
      if (slug) {
        responses[slug] = { attending: r.attending, party_size: r.party_size };
      }
    }
    return {
      id: p.id,
      primary_name: p.primary_name,
      normalized_name: p.normalized_name,
      email: p.email,
      phone: p.phone,
      message: p.message,
      created_at: p.created_at,
      updated_at: p.updated_at,
      responses,
      member_names: p.party_members.map((m) => m.name),
    };
  });
}

export interface AuditRow {
  id: string;
  party_id: string | null;
  actor_type: string;
  actor_identifier: string | null;
  action: string;
  previous_state: unknown;
  new_state: unknown;
  created_at: string;
}

export async function recentAudit(limit = 50, partyId?: string): Promise<AuditRow[]> {
  let query = supabaseAdmin()
    .from("rsvp_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (partyId) query = query.eq("party_id", partyId);

  const { data, error } = await query;
  if (error) throw new Error(`recentAudit failed: ${error.message}`);
  return (data ?? []) as AuditRow[];
}

export interface DuplicateGroup {
  key: string;
  reason: "name" | "email" | "phone";
  parties: AdminPartyRow[];
}

/** Groups likely duplicates by normalized name, email, or phone. */
export function findDuplicateGroups(parties: AdminPartyRow[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const byKey = (
    key: (p: AdminPartyRow) => string | null,
    reason: DuplicateGroup["reason"],
  ) => {
    const map = new Map<string, AdminPartyRow[]>();
    for (const p of parties) {
      const k = key(p);
      if (!k) continue;
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    for (const [k, list] of map) {
      if (list.length > 1) groups.push({ key: k, reason, parties: list });
    }
  };
  byKey((p) => p.normalized_name || null, "name");
  byKey((p) => p.email?.toLowerCase() ?? null, "email");
  byKey((p) => p.phone?.replace(/[^\d+]/g, "") || null, "phone");

  // De-duplicate groups that contain the same party set.
  const seen = new Set<string>();
  return groups.filter((g) => {
    const sig = g.parties
      .map((p) => p.id)
      .sort()
      .join("|");
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}
