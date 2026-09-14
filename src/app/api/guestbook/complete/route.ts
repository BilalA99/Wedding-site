import { NextResponse } from "next/server";

import { completeUploadSchema } from "@/lib/guestbook-validation";
import {
  getEntryBySubmissionId,
  logGuestbookAudit,
  updateEntry,
} from "@/lib/guestbook-service";
import { getFile } from "@/lib/google/drive";
import { maxBytesFor } from "@/lib/guestbook-shared";
import { clientKeyFromHeaders, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Finalizes a submission after the browser finishes its direct-to-Drive
 * upload. The client supplies Drive file ids, but nothing is trusted: the
 * file must exist, carry the server-generated name, sit in the folder the
 * server chose, and have a plausible size and MIME type.
 */
export async function POST(request: Request) {
  const clientKey = clientKeyFromHeaders(request.headers);
  if (!rateLimit(`gb-complete:${clientKey}`, 300, 10 * 60_000)) {
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

  const parsed = completeUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { submissionId, driveFileId, driveThumbnailFileId } = parsed.data;

  try {
    const entry = await getEntryBySubmissionId(submissionId);
    if (!entry) {
      return NextResponse.json({ error: "Unknown submission" }, { status: 404 });
    }
    if (entry.status === "complete") {
      return NextResponse.json({ ok: true, alreadyComplete: true });
    }

    const file = await getFile(driveFileId);
    if (
      !file ||
      file.trashed ||
      file.name !== entry.stored_file_name ||
      !file.parents?.includes(entry.drive_folder_id ?? "")
    ) {
      return NextResponse.json(
        { error: "Upload could not be verified." },
        { status: 422 },
      );
    }

    const size = file.size ? Number(file.size) : null;
    const expectedBase = entry.mime_type?.split("/")[0];
    const actualBase = file.mimeType?.split("/")[0];
    if (
      (size != null && size > maxBytesFor(entry.media_type)) ||
      (expectedBase && actualBase && expectedBase !== actualBase)
    ) {
      return NextResponse.json(
        { error: "Upload could not be verified." },
        { status: 422 },
      );
    }

    // Thumbnail is best-effort: verify if provided, drop silently otherwise.
    let thumbnailId: string | null = null;
    if (driveThumbnailFileId) {
      const thumb = await getFile(driveThumbnailFileId);
      if (
        thumb &&
        !thumb.trashed &&
        thumb.name.startsWith(`thumb_${entry.event_type}_${submissionId}`)
      ) {
        thumbnailId = thumb.id;
      }
    }

    const updated = await updateEntry(entry.id, {
      drive_file_id: file.id,
      drive_thumbnail_file_id: thumbnailId,
      file_size: size ?? entry.file_size,
      status: "complete",
      completed_at: new Date().toISOString(),
    });

    await logGuestbookAudit({
      entry_id: entry.id,
      actor_type: "guest",
      action: "upload_completed",
      new_state: {
        media_type: updated.media_type,
        event: updated.event_type,
        file_size: updated.file_size,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[guestbook:${errorId}] complete failed`, {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "We couldn't confirm your upload. Please try again." },
      { status: 500 },
    );
  }
}
