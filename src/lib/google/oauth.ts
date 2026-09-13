import "server-only";

import { loadIntegration, saveIntegration } from "@/lib/google/tokens";

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
] as const;

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_CLIENT_ID is not configured");
  return v;
}

function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  return v;
}

export function oauthRedirectUri(origin: string): string {
  return `${origin}/api/google/oauth/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: oauthRedirectUri(origin),
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface ExchangedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string | null;
  email: string | null;
  grantedScopes: string[];
}

export async function exchangeCode(
  code: string,
  origin: string,
): Promise<ExchangedTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: oauthRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status})`);
  }
  const json = (await res.json()) as TokenResponse;

  // Read the account email from the id_token payload (no extra API call;
  // signature verification is unnecessary — it came straight from Google
  // over TLS in a confidential-client exchange).
  let email: string | null = null;
  const idTokenPayload = json.id_token?.split(".")[1];
  if (idTokenPayload) {
    try {
      const payload = JSON.parse(
        Buffer.from(idTokenPayload, "base64url").toString("utf8"),
      ) as { email?: string };
      email = payload.email ?? null;
    } catch {
      email = null;
    }
  }

  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
    refreshToken: json.refresh_token ?? null,
    email,
    grantedScopes: (json.scope ?? "").split(" ").filter(Boolean),
  };
}

// Module-level access token cache. Serverless instances are reused under
// Fluid Compute, so this avoids a refresh round-trip on most requests.
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/** Error thrown when the stored refresh token no longer works. */
export class GoogleNotConnectedError extends Error {
  constructor(message = "Google Drive is not connected") {
    super(message);
    this.name = "GoogleNotConnectedError";
  }
}

export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const { refreshToken } = await loadIntegration();
  if (!refreshToken) throw new GoogleNotConnectedError();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    let code = "";
    try {
      code = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      // ignore body parse failures
    }
    if (code === "invalid_grant") {
      // Refresh token revoked/expired — surface "reconnect" in admin UI.
      await saveIntegration({ broken: true });
      throw new GoogleNotConnectedError(
        "Google Drive connection expired — reconnect from the admin panel",
      );
    }
    throw new Error(`Google token refresh failed (${res.status})`);
  }

  const json = (await res.json()) as TokenResponse;
  cachedAccessToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

/** Used by the OAuth callback to prime the cache with a fresh token. */
export function primeAccessToken(token: string, expiresIn: number): void {
  cachedAccessToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
}

export function clearAccessTokenCache(): void {
  cachedAccessToken = null;
}
