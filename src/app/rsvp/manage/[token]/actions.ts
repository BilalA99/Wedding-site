"use server";

import { revalidatePath } from "next/cache";

import { isPlausibleToken } from "@/lib/tokens";
import { rsvpUpdateSchema } from "@/lib/validation";
import { findPartyByToken, updateRsvp } from "@/lib/rsvp-service";

export interface ManageActionState {
  ok: boolean;
  error?: string;
  issues?: { path: string; message: string }[];
}

export async function updateRsvpAction(
  token: string,
  payload: unknown,
): Promise<ManageActionState> {
  if (!isPlausibleToken(token)) {
    return { ok: false, error: "This management link is not valid." };
  }

  const party = await findPartyByToken(token).catch(() => null);
  if (!party) {
    return { ok: false, error: "This management link is not valid." };
  }

  const parsed = rsvpUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please review the highlighted fields.",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  try {
    await updateRsvp(party.id, parsed.data, { type: "guest" });
    revalidatePath(`/rsvp/manage/${token}`);
    return { ok: true };
  } catch (error) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[rsvp-manage:${errorId}] update failed`, {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: `We couldn't save your changes. Please try again. (ref ${errorId})`,
    };
  }
}
