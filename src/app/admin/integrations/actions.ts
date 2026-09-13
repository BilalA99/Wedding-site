"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { getAbout } from "@/lib/google/drive";
import { ensureFolderStructure } from "@/lib/google/folders";
import { saveIntegration } from "@/lib/google/tokens";
import { GoogleNotConnectedError } from "@/lib/google/oauth";

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

/** Round-trips the Drive API and folder structure, updating lastVerifiedAt. */
export async function verifyGoogleConnectionAction(): Promise<VerifyResult> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized" };

  try {
    const about = await getAbout();
    await ensureFolderStructure();
    await saveIntegration({
      accountEmail: about.email ?? undefined,
      lastVerifiedAt: new Date().toISOString(),
      broken: false,
    });
    revalidatePath("/admin/integrations");
    return { ok: true };
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      revalidatePath("/admin/integrations");
      return { ok: false, error: "Google Drive needs to be reconnected." };
    }
    console.error("[admin] google verify failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Verification failed — please retry." };
  }
}
