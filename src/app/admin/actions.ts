"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { rsvpUpdateSchema } from "@/lib/validation";
import { deleteRsvp, updateRsvp } from "@/lib/rsvp-service";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

export async function adminUpdateRsvpAction(
  partyId: string,
  payload: unknown,
): Promise<AdminActionResult> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };

  const parsed = rsvpUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  try {
    await updateRsvp(partyId, parsed.data, {
      type: "admin",
      identifier: admin,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/rsvps");
    return { ok: true };
  } catch (error) {
    console.error("[admin] update failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Update failed — please retry." };
  }
}

export async function adminDeleteRsvpAction(
  partyId: string,
): Promise<AdminActionResult> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };

  try {
    await deleteRsvp(partyId, admin);
    revalidatePath("/admin");
    revalidatePath("/admin/rsvps");
    return { ok: true };
  } catch (error) {
    console.error("[admin] delete failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Delete failed — please retry." };
  }
}

export async function adminSignOutAction(): Promise<void> {
  const { supabaseAuthServer } = await import("@/lib/supabase/server-auth");
  const supabase = await supabaseAuthServer();
  await supabase.auth.signOut();
}
