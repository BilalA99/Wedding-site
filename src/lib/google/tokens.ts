import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";

const INTEGRATION_KEY = "google_drive";

/** Non-secret connection state, stored alongside the encrypted token. */
export interface GoogleDriveIntegrationData {
  accountEmail?: string;
  rootFolderId?: string;
  rootFolderName?: string;
  /** event → { videos, photos, thumbnails } Drive folder ids */
  folders?: Record<
    string,
    { videos: string; photos: string; thumbnails: string }
  >;
  connectedAt?: string;
  lastVerifiedAt?: string;
  /** Set when a refresh fails with invalid_grant — admin must reconnect. */
  broken?: boolean;
}

export interface GoogleDriveIntegration {
  data: GoogleDriveIntegrationData;
  refreshToken: string | null;
}

export async function loadIntegration(): Promise<GoogleDriveIntegration> {
  const { data, error } = await supabaseAdmin()
    .from("app_integrations")
    .select("data, secret_ciphertext")
    .eq("key", INTEGRATION_KEY)
    .maybeSingle();
  if (error) throw new Error(`loadIntegration failed: ${error.message}`);
  if (!data) return { data: {}, refreshToken: null };

  let refreshToken: string | null = null;
  if (data.secret_ciphertext) {
    refreshToken = decryptSecret(data.secret_ciphertext as string);
  }
  return {
    data: (data.data ?? {}) as GoogleDriveIntegrationData,
    refreshToken,
  };
}

export async function saveIntegration(
  patch: Partial<GoogleDriveIntegrationData>,
  refreshToken?: string,
): Promise<void> {
  const current = await loadIntegration();
  const merged = { ...current.data, ...patch };

  const row: Record<string, unknown> = { key: INTEGRATION_KEY, data: merged };
  if (refreshToken !== undefined) {
    row.secret_ciphertext = encryptSecret(refreshToken);
  }

  const { error } = await supabaseAdmin()
    .from("app_integrations")
    .upsert(row, { onConflict: "key" });
  if (error) throw new Error(`saveIntegration failed: ${error.message}`);
}
