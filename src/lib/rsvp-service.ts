import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeName } from "@/lib/normalize";
import { generateManageToken, hashManageToken } from "@/lib/tokens";
import type { RsvpSubmission, RsvpUpdate } from "@/lib/validation";
import type { EventSlug } from "@/config/wedding";

export interface PartyEventResponse {
  event_slug: EventSlug;
  attending: boolean;
  party_size: number;
}

export interface PartyRecord {
  id: string;
  primary_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
  responses: PartyEventResponse[];
  member_names: string[];
}

/** Creates an RSVP atomically via the submit_rsvp RPC. Idempotent. */
export async function createRsvp(
  submission: RsvpSubmission,
): Promise<{ partyId: string; created: boolean; manageToken: string }> {
  const manageToken = generateManageToken();
  const manageTokenHash = await hashManageToken(manageToken);

  const { data, error } = await supabaseAdmin().rpc("submit_rsvp", {
    payload: {
      client_submission_id: submission.client_submission_id,
      primary_name: submission.primary_name,
      normalized_name: normalizeName(submission.primary_name),
      email: submission.email ?? "",
      phone: submission.phone ?? "",
      message: submission.message ?? "",
      source: "open",
      manage_token_hash: manageTokenHash,
      responses: submission.responses,
      member_names: submission.member_names ?? [],
    },
  });

  if (error) {
    throw new Error(`submit_rsvp failed: ${error.message}`);
  }

  const result = data as { party_id: string; created: boolean };
  // On an idempotent replay the original token was already returned to the
  // guest; a fresh token can't be recovered (only the hash is stored), so the
  // manage token is only meaningful when created === true. The success screen
  // already delivered it on the first, accepted request.
  return {
    partyId: result.party_id,
    created: result.created,
    manageToken: result.created ? manageToken : "",
  };
}

export async function findPartyByToken(
  token: string,
): Promise<PartyRecord | null> {
  const tokenHash = await hashManageToken(token);
  const db = supabaseAdmin();

  const { data: party, error } = await db
    .from("rsvp_parties")
    .select("id, primary_name, email, phone, message, created_at, updated_at")
    .eq("manage_token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(`token lookup failed: ${error.message}`);
  if (!party) return null;

  return hydrateParty(party);
}

export async function findPartyById(id: string): Promise<PartyRecord | null> {
  const { data: party, error } = await supabaseAdmin()
    .from("rsvp_parties")
    .select("id, primary_name, email, phone, message, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`party lookup failed: ${error.message}`);
  if (!party) return null;
  return hydrateParty(party);
}

async function hydrateParty(party: {
  id: string;
  primary_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}): Promise<PartyRecord> {
  const db = supabaseAdmin();

  const [{ data: responses }, { data: members }] = await Promise.all([
    db
      .from("party_event_responses")
      .select("attending, party_size, events!inner(slug, display_order)")
      .eq("party_id", party.id),
    db
      .from("party_members")
      .select("name, created_at")
      .eq("party_id", party.id)
      .order("created_at"),
  ]);

  type ResponseRow = {
    attending: boolean;
    party_size: number;
    events: { slug: string; display_order: number };
  };

  const sorted = ((responses ?? []) as unknown as ResponseRow[]).sort(
    (a, b) => a.events.display_order - b.events.display_order,
  );

  return {
    ...party,
    responses: sorted.map((r) => ({
      event_slug: r.events.slug as EventSlug,
      attending: r.attending,
      party_size: r.party_size,
    })),
    member_names: (members ?? []).map((m: { name: string }) => m.name),
  };
}

export async function updateRsvp(
  partyId: string,
  update: RsvpUpdate,
  actor: { type: "guest" | "admin"; identifier?: string },
): Promise<void> {
  const payload: Record<string, unknown> = {
    actor_type: actor.type,
    actor_identifier: actor.identifier ?? null,
    action: actor.type === "admin" ? "admin_updated" : "guest_updated",
  };

  if (update.primary_name !== undefined) {
    payload.primary_name = update.primary_name;
    payload.normalized_name = normalizeName(update.primary_name);
  }
  if (update.email !== undefined) payload.email = update.email;
  if (update.phone !== undefined) payload.phone = update.phone;
  if (update.message !== undefined) payload.message = update.message;
  if (update.member_names !== undefined) payload.member_names = update.member_names;
  if (update.responses !== undefined) payload.responses = update.responses;

  const { error } = await supabaseAdmin().rpc("update_rsvp", {
    p_party_id: partyId,
    payload,
  });

  if (error) throw new Error(`update_rsvp failed: ${error.message}`);
}

export async function deleteRsvp(partyId: string, actor: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("delete_rsvp", {
    p_party_id: partyId,
    p_actor: actor,
  });
  if (error) throw new Error(`delete_rsvp failed: ${error.message}`);
}

/** True when an RSVP with the same normalized name already exists. */
export async function similarPartyExists(name: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin()
    .from("rsvp_parties")
    .select("id", { count: "exact", head: true })
    .eq("normalized_name", normalizeName(name));

  if (error) return false; // advisory only — never block submission on this
  return (count ?? 0) > 0;
}

export interface EventSummary {
  event_id: string;
  slug: EventSlug;
  name: string;
  parties_attending: number;
  parties_declined: number;
  guests_attending: number;
}

export async function getEventSummaries(): Promise<EventSummary[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_attendance_summary")
    .select("*");
  if (error) throw new Error(`summary query failed: ${error.message}`);
  return (data ?? []) as EventSummary[];
}
