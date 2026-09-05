"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseCsv } from "@/lib/csv";

import { IMPORT_HEADERS } from "./import-headers";

const householdSchema = z.object({
  display_name: z.string().trim().min(1).max(200),
  max_party_size: z.coerce.number().int().min(1).max(50).default(10),
  allow_plus_one: z.coerce.boolean().default(false),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().max(40).optional(),
});

export interface InviteActionResult {
  ok: boolean;
  error?: string;
}

export async function addHouseholdAction(
  input: unknown,
): Promise<InviteActionResult> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };

  const parsed = householdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the household details." };
  }

  const { error } = await supabaseAdmin().from("households").insert({
    display_name: parsed.data.display_name,
    max_party_size: parsed.data.max_party_size,
    allow_plus_one: parsed.data.allow_plus_one,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
  });

  if (error) return { ok: false, error: "Could not add household." };
  revalidatePath("/admin/invitations");
  return { ok: true };
}

export async function deleteHouseholdAction(
  id: string,
): Promise<InviteActionResult> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid id" };
  }

  const { error } = await supabaseAdmin()
    .from("households")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not remove household." };
  revalidatePath("/admin/invitations");
  return { ok: true };
}

export interface ImportPreviewRow {
  line: number;
  household: string;
  guest: string;
  invitedHenna: boolean;
  invitedWedding: boolean;
  plusOne: boolean;
  maxPartySize: number;
  problems: string[];
}

export interface ImportPreview {
  ok: boolean;
  error?: string;
  rows: ImportPreviewRow[];
  validCount: number;
  invalidCount: number;
}


function parseBool(value: string, fallback = false): boolean {
  const v = value.trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(v)) return true;
  if (["false", "no", "n", "0", ""].includes(v)) return fallback;
  return fallback;
}

export async function previewImportAction(
  csvText: string,
): Promise<ImportPreview> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized", rows: [], validCount: 0, invalidCount: 0 };

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      ok: false,
      error: "The CSV needs a header row and at least one guest row.",
      rows: [],
      validCount: 0,
      invalidCount: 0,
    };
  }

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const missing = IMPORT_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing columns: ${missing.join(", ")}`,
      rows: [],
      validCount: 0,
      invalidCount: 0,
    };
  }

  const col = (name: string) => header.indexOf(name);
  const preview: ImportPreviewRow[] = rows.slice(1).map((r, i) => {
    const problems: string[] = [];
    const household = (r[col("household_name")] ?? "").trim();
    const first = (r[col("guest_first_name")] ?? "").trim();
    const last = (r[col("guest_last_name")] ?? "").trim();
    const rawMax = (r[col("max_party_size")] ?? "").trim();
    const maxPartySize = rawMax ? Number.parseInt(rawMax, 10) : 10;

    if (!household) problems.push("household_name is empty");
    if (!first) problems.push("guest_first_name is empty");
    if (rawMax && (Number.isNaN(maxPartySize) || maxPartySize < 1 || maxPartySize > 50)) {
      problems.push("max_party_size must be 1–50");
    }

    return {
      line: i + 2,
      household,
      guest: `${first} ${last}`.trim(),
      invitedHenna: parseBool(r[col("invited_henna")] ?? "", true),
      invitedWedding: parseBool(r[col("invited_wedding")] ?? "", true),
      plusOne: parseBool(r[col("plus_one_allowed")] ?? ""),
      maxPartySize: Number.isNaN(maxPartySize) ? 10 : maxPartySize,
      problems,
    };
  });

  return {
    ok: true,
    rows: preview,
    validCount: preview.filter((r) => r.problems.length === 0).length,
    invalidCount: preview.filter((r) => r.problems.length > 0).length,
  };
}

export async function commitImportAction(
  csvText: string,
): Promise<InviteActionResult & { imported?: number }> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };

  const preview = await previewImportAction(csvText);
  if (!preview.ok) return { ok: false, error: preview.error };
  if (preview.invalidCount > 0) {
    return {
      ok: false,
      error: `Fix ${preview.invalidCount} invalid row(s) before importing.`,
    };
  }

  const db = supabaseAdmin();

  // Event ids for eligibility rows.
  const { data: events } = await db.from("events").select("id, slug");
  const eventIds = new Map(
    (events ?? []).map((e: { id: string; slug: string }) => [e.slug, e.id]),
  );

  const rows = parseCsv(csvText);
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const householdCache = new Map<string, string>();
  let imported = 0;

  for (const r of rows.slice(1)) {
    const householdName = (r[col("household_name")] ?? "").trim();
    let householdId = householdCache.get(householdName.toLowerCase());

    if (!householdId) {
      // Reuse an existing household with the same name instead of duplicating.
      const { data: existing } = await db
        .from("households")
        .select("id")
        .ilike("display_name", householdName)
        .maybeSingle();

      if (existing) {
        householdId = existing.id as string;
      } else {
        const rawMax = (r[col("max_party_size")] ?? "").trim();
        const maxSize = rawMax ? Number.parseInt(rawMax, 10) : 10;
        const { data: created, error } = await db
          .from("households")
          .insert({
            display_name: householdName,
            max_party_size: Number.isNaN(maxSize) ? 10 : maxSize,
            allow_plus_one: parseBool(r[col("plus_one_allowed")] ?? ""),
            email: (r[col("email")] ?? "").trim() || null,
            phone: (r[col("phone")] ?? "").trim() || null,
          })
          .select("id")
          .single();
        if (error || !created) {
          return { ok: false, error: `Import failed at "${householdName}".` };
        }
        householdId = created.id as string;
      }
      householdCache.set(householdName.toLowerCase(), householdId);
    }

    const { data: guest, error: guestError } = await db
      .from("invited_guests")
      .insert({
        household_id: householdId,
        first_name: (r[col("guest_first_name")] ?? "").trim(),
        last_name: (r[col("guest_last_name")] ?? "").trim(),
      })
      .select("id")
      .single();
    if (guestError || !guest) {
      return { ok: false, error: "Import failed while adding a guest." };
    }

    const eligibility = [
      { slug: "henna", invited: parseBool(r[col("invited_henna")] ?? "", true) },
      { slug: "wedding", invited: parseBool(r[col("invited_wedding")] ?? "", true) },
    ];
    for (const e of eligibility) {
      const eventId = eventIds.get(e.slug);
      if (!eventId) continue;
      await db.from("invited_guest_events").insert({
        guest_id: guest.id,
        event_id: eventId,
        is_invited: e.invited,
      });
    }
    imported++;
  }

  revalidatePath("/admin/invitations");
  return { ok: true, imported };
}
