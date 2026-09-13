/**
 * Canonical origin for OAuth redirect URIs and absolute links. Comes from
 * config, never from request headers, so a spoofed Host can't redirect the
 * OAuth flow.
 */
export function siteOrigin(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:3000";
}
