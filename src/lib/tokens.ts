/**
 * Management-token utilities. Tokens are opaque 32-byte random values given
 * to guests once; only the SHA-256 hash is stored. Uses Web Crypto so the
 * same code runs in Node route handlers and tests.
 */

const TOKEN_BYTES = 32;

export function generateManageToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function hashManageToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return base64Url(new Uint8Array(digest));
}

/** Tokens are 43 base64url chars (32 bytes). Reject anything else early. */
export function isPlausibleToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
