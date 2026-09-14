import { NextResponse } from "next/server";

import { uploadSessionSchema } from "@/lib/guestbook-validation";
import {
  sanitizeOriginalFileName,
  storedFileName,
} from "@/lib/guestbook-shared";
import {
  logGuestbookAudit,
  upsertPendingEntry,
} from "@/lib/guestbook-service";
import { folderFor, thumbnailFolderFor } from "@/lib/google/folders";
import { createResumableSession } from "@/lib/google/drive";
import { GoogleNotConnectedError } from "@/lib/google/oauth";
import { clientKeyFromHeaders, rateLimit } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";

const FRIENDLY_UNAVAILABLE =
  "Uploads are temporarily unavailable. Your memory is still on your phone — please try again soon.";

export async function POST(request: Request) {
  // Generous limits: a wedding venue shares one IP across every guest, so
  // abuse is caught by honeypot + validation + size caps, not strict IPs.
  const clientKey = clientKeyFromHeaders(request.headers);
  if (!rateLimit(`gb-session:${clientKey}`, 300, 10 * 60_000)) {
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

  const parsed = uploadSessionSchema.safeParse(body);
  if (!parsed.success) {
    const firstMessage =
      parsed.error.issues.find((i) => i.code === "custom")?.message ??
      "Please check your file and try again.";
    return NextResponse.json({ error: firstMessage }, { status: 400 });
  }
  const input = parsed.data;

  // Honeypot filled → pretend success without touching anything.
  if (input.website) {
    return NextResponse.json({
      ok: true,
      uploadUrl: null,
      thumbnailUploadUrl: null,
    });
  }

  try {
    const folderId = await folderFor(input.event, input.mediaType);
    const name = storedFileName(input.event, input.submissionId, input.mimeType);

    const entry = await upsertPendingEntry({
      client_submission_id: input.submissionId,
      guest_name: input.guestName ?? null,
      message: input.message ?? null,
      event_type: input.event,
      media_type: input.mediaType,
      kind: input.kind,
      batch_id: input.batchId ?? null,
      drive_folder_id: folderId,
      original_file_name: sanitizeOriginalFileName(input.fileName),
      stored_file_name: name,
      mime_type: input.mimeType.toLowerCase(),
      file_size: input.fileSize,
      duration_seconds: input.durationSeconds ?? null,
    });
    if (!entry) {
      return NextResponse.json(
        { error: "This memory was already uploaded." },
        { status: 409 },
      );
    }

    const origin = siteOrigin();
    const uploadUrl = await createResumableSession({
      name,
      mimeType: input.mimeType,
      parentId: folderId,
      fileSize: input.fileSize,
      origin,
    });

    let thumbnailUploadUrl: string | null = null;
    if (input.thumbnail) {
      const thumbFolderId = await thumbnailFolderFor(input.event);
      thumbnailUploadUrl = await createResumableSession({
        name: `thumb_${input.event}_${input.submissionId}.${
          input.thumbnail.mimeType === "image/webp" ? "webp" : "jpg"
        }`,
        mimeType: input.thumbnail.mimeType,
        parentId: thumbFolderId,
        fileSize: input.thumbnail.fileSize,
        origin,
      });
    }

    await logGuestbookAudit({
      entry_id: entry.id,
      actor_type: "guest",
      action: "upload_session_created",
      new_state: {
        event: input.event,
        media_type: input.mediaType,
        kind: input.kind,
        file_size: input.fileSize,
      },
    });

    return NextResponse.json({ ok: true, uploadUrl, thumbnailUploadUrl });
  } catch (error) {
    const errorId = crypto.randomUUID().slice(0, 8);
    const notConnected = error instanceof GoogleNotConnectedError;
    console.error(`[guestbook:${errorId}] upload-session failed`, {
      message: error instanceof Error ? error.message : "unknown",
      notConnected,
    });
    return NextResponse.json(
      { error: FRIENDLY_UNAVAILABLE },
      { status: 503 },
    );
  }
}
