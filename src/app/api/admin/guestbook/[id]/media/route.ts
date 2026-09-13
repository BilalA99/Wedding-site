import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { getEntryById } from "@/lib/guestbook-service";
import { driveMediaResponse } from "@/lib/google/drive";

export const runtime = "nodejs";

/**
 * Streams a guestbook file from Drive to a signed-in admin, forwarding
 * Range headers so video seeking works. Bytes are piped, never buffered.
 * `?download=1` forces a save-as with the original filename.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const entry = await getEntryById(id);
  if (!entry?.drive_file_id || entry.status === "deleted") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";

  try {
    const upstream = await driveMediaResponse(
      entry.drive_file_id,
      request.headers.get("range"),
    );
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: "Media unavailable" },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      entry.mime_type ?? upstream.headers.get("content-type") ?? "application/octet-stream",
    );
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("accept-ranges")) headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, no-store");
    if (download) {
      const filename = (
        entry.original_file_name || entry.stored_file_name || "memory"
      ).replace(/["\r\n]/g, "");
      headers.set(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("guestbook media stream failed", {
      id,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Media unavailable" }, { status: 502 });
  }
}
