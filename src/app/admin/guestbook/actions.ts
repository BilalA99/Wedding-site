"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/supabase/server-auth";
import {
  getEntryById,
  logGuestbookAudit,
  updateEntry,
} from "@/lib/guestbook-service";
import { adminEditEntrySchema } from "@/lib/guestbook-validation";
import { trashFile, untrashFile } from "@/lib/google/drive";

export interface GuestbookActionResult {
  ok: boolean;
  error?: string;
}

export async function toggleFavoriteAction(
  entryId: string,
): Promise<GuestbookActionResult> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };

  try {
    const entry = await getEntryById(entryId);
    if (!entry) return { ok: false, error: "Entry not found" };

    const favorite = !entry.favorite;
    await updateEntry(entryId, { favorite });
    await logGuestbookAudit({
      entry_id: entryId,
      actor_type: "admin",
      actor_identifier: admin,
      action: favorite ? "favorite" : "unfavorite",
    });
    revalidatePath("/admin/guestbook");
    return { ok: true };
  } catch (error) {
    console.error("[admin] guestbook favorite failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Could not update — please retry." };
  }
}

export async function editEntryAction(
  entryId: string,
  payload: unknown,
): Promise<GuestbookActionResult> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };

  const parsed = adminEditEntrySchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Please check the fields and try again." };
  }

  try {
    const entry = await getEntryById(entryId);
    if (!entry) return { ok: false, error: "Entry not found" };

    await updateEntry(entryId, {
      guest_name: parsed.data.guestName ?? null,
      message: parsed.data.message ?? null,
      event_type: parsed.data.event,
    });
    await logGuestbookAudit({
      entry_id: entryId,
      actor_type: "admin",
      actor_identifier: admin,
      action: "edit_details",
      previous_state: {
        guest_name: entry.guest_name,
        message: entry.message,
        event_type: entry.event_type,
      },
      new_state: {
        guest_name: parsed.data.guestName ?? null,
        message: parsed.data.message ?? null,
        event_type: parsed.data.event,
      },
    });
    revalidatePath("/admin/guestbook");
    return { ok: true };
  } catch (error) {
    console.error("[admin] guestbook edit failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Update failed — please retry." };
  }
}

/** Soft delete: Drive files move to Trash; the row is marked deleted so the
 * history (and restore) stays available. */
export async function deleteEntryAction(
  entryId: string,
): Promise<GuestbookActionResult> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };

  try {
    const entry = await getEntryById(entryId);
    if (!entry) return { ok: false, error: "Entry not found" };
    if (entry.status === "deleted") return { ok: true };

    if (entry.drive_file_id) await trashFile(entry.drive_file_id);
    if (entry.drive_thumbnail_file_id) {
      await trashFile(entry.drive_thumbnail_file_id);
    }

    await updateEntry(entryId, {
      status: "deleted",
      deleted_at: new Date().toISOString(),
    });
    await logGuestbookAudit({
      entry_id: entryId,
      actor_type: "admin",
      actor_identifier: admin,
      action: "delete",
      previous_state: { status: entry.status },
    });
    revalidatePath("/admin/guestbook");
    return { ok: true };
  } catch (error) {
    console.error("[admin] guestbook delete failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Delete failed — please retry." };
  }
}

export async function restoreEntryAction(
  entryId: string,
): Promise<GuestbookActionResult> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };

  try {
    const entry = await getEntryById(entryId);
    if (!entry) return { ok: false, error: "Entry not found" };
    if (entry.status !== "deleted") return { ok: true };

    if (entry.drive_file_id) await untrashFile(entry.drive_file_id);
    if (entry.drive_thumbnail_file_id) {
      await untrashFile(entry.drive_thumbnail_file_id);
    }

    await updateEntry(entryId, { status: "complete", deleted_at: null });
    await logGuestbookAudit({
      entry_id: entryId,
      actor_type: "admin",
      actor_identifier: admin,
      action: "restore",
    });
    revalidatePath("/admin/guestbook");
    return { ok: true };
  } catch (error) {
    console.error("[admin] guestbook restore failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Restore failed — please retry." };
  }
}
