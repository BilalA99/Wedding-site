"use client";

import { UPLOAD_CHUNK_BYTES } from "@/lib/guestbook-shared";

/** Thrown when the Drive resumable session is gone — the caller should ask
 * the server for a fresh session and restart. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Upload session expired");
    this.name = "SessionExpiredError";
  }
}

export class UploadAbortedError extends Error {
  constructor() {
    super("Upload aborted");
    this.name = "UploadAbortedError";
  }
}

interface ChunkResult {
  done: boolean;
  /** Next byte to send (from Google's confirmed Range). */
  nextByte: number;
  fileId?: string;
}

function putChunk(
  sessionUrl: string,
  body: Blob | null,
  contentRange: string,
  signal: AbortSignal,
  onProgress?: (sentInChunk: number) => void,
): Promise<ChunkResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessionUrl, true);
    xhr.setRequestHeader("Content-Range", contentRange);
    xhr.responseType = "text";
    xhr.timeout = 120_000;

    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded);
      };
    }

    xhr.onload = () => {
      signal.removeEventListener("abort", onAbort);
      if (xhr.status === 200 || xhr.status === 201) {
        let fileId: string | undefined;
        try {
          fileId = (JSON.parse(xhr.responseText) as { id?: string }).id;
        } catch {
          fileId = undefined;
        }
        resolve({ done: true, nextByte: 0, fileId });
      } else if (xhr.status === 308) {
        const range = xhr.getResponseHeader("Range"); // "bytes=0-524287"
        const confirmed = range ? Number(range.split("-")[1]) + 1 : 0;
        resolve({ done: false, nextByte: confirmed });
      } else if (xhr.status === 404 || xhr.status === 410) {
        reject(new SessionExpiredError());
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error("Network error"));
    };
    xhr.ontimeout = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error("Network timeout"));
    };
    xhr.onabort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new UploadAbortedError());
    };

    xhr.send(body);
  });
}

/** Asks Google how many bytes it has — used to resume after a drop. */
async function queryOffset(
  sessionUrl: string,
  total: number,
  signal: AbortSignal,
): Promise<ChunkResult> {
  return putChunk(sessionUrl, null, `bytes */${total}`, signal);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Chunked resumable upload straight from the browser to Google Drive.
 * Retries transient failures with exponential backoff, resuming from the
 * last byte Google confirms rather than restarting.
 */
export async function uploadResumable(
  file: Blob,
  sessionUrl: string,
  opts: {
    signal: AbortSignal;
    onProgress: (sentBytes: number, totalBytes: number) => void;
  },
): Promise<{ fileId: string }> {
  const total = file.size;
  let offset = 0;
  let consecutiveFailures = 0;

  while (true) {
    if (opts.signal.aborted) throw new UploadAbortedError();

    const end = Math.min(offset + UPLOAD_CHUNK_BYTES, total);
    const chunk = file.slice(offset, end);
    const contentRange = `bytes ${offset}-${end - 1}/${total}`;

    try {
      const result = await putChunk(
        sessionUrl,
        chunk,
        contentRange,
        opts.signal,
        (sentInChunk) =>
          opts.onProgress(Math.min(offset + sentInChunk, total), total),
      );
      consecutiveFailures = 0;
      if (result.done) {
        opts.onProgress(total, total);
        if (!result.fileId) throw new Error("Upload finished without a file id");
        return { fileId: result.fileId };
      }
      offset = result.nextByte;
      opts.onProgress(offset, total);
    } catch (err) {
      if (
        err instanceof SessionExpiredError ||
        err instanceof UploadAbortedError
      ) {
        throw err;
      }
      consecutiveFailures += 1;
      if (consecutiveFailures > 6) throw err;

      // Back off, then ask Google where we actually are before resending.
      await wait(Math.min(15_000, 800 * 2 ** consecutiveFailures));
      try {
        const status = await queryOffset(sessionUrl, total, opts.signal);
        if (status.done) {
          opts.onProgress(total, total);
          if (!status.fileId) {
            throw new Error("Upload finished without a file id");
          }
          return { fileId: status.fileId };
        }
        offset = status.nextByte;
      } catch (statusErr) {
        if (
          statusErr instanceof SessionExpiredError ||
          statusErr instanceof UploadAbortedError
        ) {
          throw statusErr;
        }
        // Status probe also failed — keep backing off and retry the chunk.
      }
    }
  }
}

/** Small single-shot upload for thumbnails (no chunking needed). */
export async function uploadSmall(
  blob: Blob,
  sessionUrl: string,
  signal: AbortSignal,
): Promise<{ fileId: string } | null> {
  try {
    const result = await putChunk(
      sessionUrl,
      blob,
      `bytes 0-${blob.size - 1}/${blob.size}`,
      signal,
    );
    if (result.done && result.fileId) return { fileId: result.fileId };
    return null;
  } catch {
    return null; // thumbnails are best-effort
  }
}
