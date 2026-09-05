import "server-only";

/**
 * Lightweight in-memory rate limiter. Per-serverless-instance only, which is
 * fine for a wedding site: it stops bursts and scripted abuse without any
 * paid infrastructure, while the honeypot + validation handle the rest.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count += 1;
  if (buckets.size > 10_000) buckets.clear(); // bound memory
  return bucket.count <= limit;
}

export function clientKeyFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}
