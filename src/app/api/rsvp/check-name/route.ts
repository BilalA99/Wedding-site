import { NextResponse } from "next/server";

import { similarPartyExists } from "@/lib/rsvp-service";
import { clientKeyFromHeaders, rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({ name: z.string().min(1).max(120) });

/**
 * Advisory duplicate check: returns only a boolean — never any details of an
 * existing RSVP — so matching a name reveals nothing private.
 */
export async function POST(request: Request) {
  const clientKey = clientKeyFromHeaders(request.headers);
  if (!rateLimit(`check:${clientKey}`, 20, 60_000)) {
    return NextResponse.json({ exists: false });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ exists: false });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ exists: false });

  try {
    const exists = await similarPartyExists(parsed.data.name);
    return NextResponse.json({ exists });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
