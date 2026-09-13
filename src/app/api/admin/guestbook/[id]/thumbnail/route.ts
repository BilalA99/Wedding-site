import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { getEntryById } from "@/lib/guestbook-service";
import { driveMediaResponse } from "@/lib/google/drive";

export const runtime = "nodejs";

/** Streams the small gallery thumbnail (or the photo itself as fallback). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const entry = await getEntryById(id);
  const fileId =
    entry?.drive_thumbnail_file_id ??
    (entry?.media_type === "photo" ? entry.drive_file_id : null);
  if (!entry || !fileId || entry.status === "deleted") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const upstream = await driveMediaResponse(fileId);
    if (!upstream.ok) {
      return NextResponse.json({ error: "Unavailable" }, { status: 502 });
    }
    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") ?? "image/jpeg",
    );
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    // Thumbnails are immutable per entry — let the browser cache them.
    headers.set("Cache-Control", "private, max-age=3600");
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
