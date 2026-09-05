import { NextResponse } from "next/server";

import { EVENTS } from "@/config/wedding";
import { buildIcs } from "@/lib/ics";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = EVENTS.find((e) => e.slug === slug);
  if (!event) {
    return NextResponse.json({ error: "Unknown event" }, { status: 404 });
  }

  const ics = buildIcs(event);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="bilal-jennah-${event.slug}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
