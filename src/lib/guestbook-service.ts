import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  GuestbookEvent,
  GuestbookKind,
  GuestbookMediaType,
} from "@/lib/guestbook-shared";

export interface GuestbookEntry {
  id: string;
  client_submission_id: string;
  guest_name: string | null;
  message: string | null;
  event_type: GuestbookEvent;
  media_type: GuestbookMediaType;
  kind: GuestbookKind;
  batch_id: string | null;
  drive_file_id: string | null;
  drive_thumbnail_file_id: string | null;
  drive_folder_id: string | null;
  original_file_name: string | null;
  stored_file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  duration_seconds: number | null;
  status: "pending" | "uploading" | "complete" | "failed" | "deleted";
  favorite: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

/** Idempotent create-or-refresh keyed on client_submission_id. Re-posting the
 * same submission (double tap, retry, expired session) updates the existing
 * row instead of duplicating it. Returns null if the submission was already
 * completed — the caller should refuse to reopen it. */
export async function upsertPendingEntry(fields: {
  client_submission_id: string;
  guest_name?: string | null;
  message?: string | null;
  event_type: GuestbookEvent;
  media_type: GuestbookMediaType;
  kind: GuestbookKind;
  batch_id?: string | null;
  drive_folder_id: string;
  original_file_name: string;
  stored_file_name: string;
  mime_type: string;
  file_size: number;
  duration_seconds: number | null;
}): Promise<GuestbookEntry | null> {
  const db = supabaseAdmin();

  const { data: existing, error: readError } = await db
    .from("guestbook_entries")
    .select("id, status")
    .eq("client_submission_id", fields.client_submission_id)
    .maybeSingle();
  if (readError) throw new Error(`guestbook lookup failed: ${readError.message}`);
  if (existing && existing.status === "complete") return null;

  const row = {
    ...fields,
    guest_name: fields.guest_name ?? null,
    message: fields.message ?? null,
    batch_id: fields.batch_id ?? null,
    duration_seconds:
      fields.duration_seconds == null
        ? null
        : Math.round(fields.duration_seconds),
    status: "uploading" as const,
  };

  const { data, error } = await db
    .from("guestbook_entries")
    .upsert(row, { onConflict: "client_submission_id" })
    .select("*")
    .single();
  if (error) throw new Error(`guestbook upsert failed: ${error.message}`);
  return data as GuestbookEntry;
}

export async function getEntryBySubmissionId(
  submissionId: string,
): Promise<GuestbookEntry | null> {
  const { data, error } = await supabaseAdmin()
    .from("guestbook_entries")
    .select("*")
    .eq("client_submission_id", submissionId)
    .maybeSingle();
  if (error) throw new Error(`guestbook lookup failed: ${error.message}`);
  return (data as GuestbookEntry) ?? null;
}

export async function getEntryById(
  id: string,
): Promise<GuestbookEntry | null> {
  const { data, error } = await supabaseAdmin()
    .from("guestbook_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`guestbook lookup failed: ${error.message}`);
  return (data as GuestbookEntry) ?? null;
}

export async function updateEntry(
  id: string,
  patch: Partial<GuestbookEntry>,
): Promise<GuestbookEntry> {
  const { data, error } = await supabaseAdmin()
    .from("guestbook_entries")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`guestbook update failed: ${error.message}`);
  return data as GuestbookEntry;
}

export async function listEntries(): Promise<GuestbookEntry[]> {
  const { data, error } = await supabaseAdmin()
    .from("guestbook_entries")
    .select("*")
    .in("status", ["complete", "deleted"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(`guestbook list failed: ${error.message}`);
  return (data ?? []) as GuestbookEntry[];
}

export async function logGuestbookAudit(entry: {
  entry_id: string | null;
  actor_type: "guest" | "admin" | "system";
  actor_identifier?: string | null;
  action: string;
  previous_state?: unknown;
  new_state?: unknown;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("guestbook_audit_logs").insert({
    entry_id: entry.entry_id,
    actor_type: entry.actor_type,
    actor_identifier: entry.actor_identifier ?? null,
    action: entry.action,
    previous_state: entry.previous_state ?? null,
    new_state: entry.new_state ?? null,
  });
  if (error) {
    // Audit failures must never break the user-facing operation.
    console.error("guestbook audit insert failed", { message: error.message });
  }
}
