import { NextResponse } from "next/server";

import { rsvpSubmissionSchema } from "@/lib/validation";
import { createRsvp } from "@/lib/rsvp-service";
import { clientKeyFromHeaders, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const clientKey = clientKeyFromHeaders(request.headers);
  if (!rateLimit(`rsvp:${clientKey}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = rsvpSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please review the highlighted fields.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  // Honeypot filled → pretend success without writing anything.
  if (typeof (body as Record<string, unknown>).website === "string" &&
      (body as Record<string, unknown>).website !== "") {
    return NextResponse.json({ ok: true, manageToken: null });
  }

  try {
    const result = await createRsvp(parsed.data);
    return NextResponse.json({
      ok: true,
      created: result.created,
      manageToken: result.manageToken || null,
    });
  } catch (error) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[rsvp:${errorId}] submission failed`, {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error: `We couldn't save your RSVP. Please try again. (ref ${errorId})`,
      },
      { status: 500 },
    );
  }
}
