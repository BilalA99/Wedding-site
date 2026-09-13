import "server-only";

import { getAccessToken } from "@/lib/google/oauth";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Authenticated Drive fetch with exponential backoff + jitter on transient
 * failures. Respects Retry-After. Non-streaming calls only — media streaming
 * uses driveMediaResponse below so bodies are never buffered.
 */
export async function driveFetch(
  path: string,
  init: RequestInit = {},
  { attempts = 4 }: { attempts?: number } = {},
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(8000, 500 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, backoff + Math.random() * 400));
    }
    try {
      const token = await getAccessToken();
      const res = await fetch(`${DRIVE_API}${path}`, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${token}`,
        },
      });
      if (RETRYABLE_STATUS.has(res.status) && attempt < attempts - 1) {
        const retryAfter = Number(res.headers.get("retry-after"));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
        }
        lastError = new Error(`Drive API ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Drive API request failed");
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  trashed?: boolean;
  ownedByMe?: boolean;
  shared?: boolean;
}

const FILE_FIELDS = "id,name,mimeType,parents,size,trashed,ownedByMe,shared";

export async function getFile(fileId: string): Promise<DriveFile | null> {
  const res = await driveFetch(
    `/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(FILE_FIELDS)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Drive files.get failed (${res.status})`);
  return (await res.json()) as DriveFile;
}

export async function listChildren(
  parentId: string,
  extraQuery?: string,
): Promise<DriveFile[]> {
  const q = [
    `'${parentId.replace(/'/g, "\\'")}' in parents`,
    "trashed = false",
    extraQuery,
  ]
    .filter(Boolean)
    .join(" and ");
  const params = new URLSearchParams({
    q,
    fields: `files(${FILE_FIELDS})`,
    pageSize: "100",
    spaces: "drive",
  });
  const res = await driveFetch(`/files?${params}`);
  if (!res.ok) throw new Error(`Drive files.list failed (${res.status})`);
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files ?? [];
}

export async function createFolder(
  name: string,
  parentId?: string,
): Promise<DriveFile> {
  const res = await driveFetch(`/files?fields=${encodeURIComponent(FILE_FIELDS)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Drive folder create failed (${res.status})`);
  return (await res.json()) as DriveFile;
}

/**
 * Opens a Drive resumable upload session and returns its URL. The session
 * URL is safe to hand to the browser: it authorizes writing this one file
 * and carries no account token.
 */
export async function createResumableSession(opts: {
  name: string;
  mimeType: string;
  parentId: string;
  fileSize?: number;
  origin?: string;
}): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=resumable&fields=${encodeURIComponent(FILE_FIELDS)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        ...(opts.fileSize
          ? { "X-Upload-Content-Length": String(opts.fileSize) }
          : {}),
        "X-Upload-Content-Type": opts.mimeType,
        ...(opts.origin ? { Origin: opts.origin } : {}),
      },
      body: JSON.stringify({
        name: opts.name,
        parents: [opts.parentId],
        mimeType: opts.mimeType,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Drive resumable session failed (${res.status})`);
  }
  const location = res.headers.get("location");
  if (!location) throw new Error("Drive resumable session missing Location");
  return location;
}

export async function trashFile(fileId: string): Promise<void> {
  const res = await driveFetch(`/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Drive trash failed (${res.status})`);
  }
}

export async function untrashFile(fileId: string): Promise<void> {
  const res = await driveFetch(`/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: false }),
  });
  if (!res.ok) throw new Error(`Drive restore failed (${res.status})`);
}

/**
 * Fetches file bytes for streaming, forwarding an optional Range header.
 * Returns Google's raw response — the caller pipes res.body onward without
 * buffering.
 */
export async function driveMediaResponse(
  fileId: string,
  range?: string | null,
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(range ? { Range: range } : {}),
      },
    },
  );
}

/** Lists sharing permissions — used to verify uploads stay private. */
export async function listPermissions(
  fileId: string,
): Promise<{ id: string; type: string; role: string }[]> {
  const res = await driveFetch(
    `/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,type,role)`,
  );
  if (!res.ok) throw new Error(`Drive permissions.list failed (${res.status})`);
  const json = (await res.json()) as {
    permissions?: { id: string; type: string; role: string }[];
  };
  return json.permissions ?? [];
}

/** Connected account info (email + storage quota) for the admin panel. */
export async function getAbout(): Promise<{
  email: string | null;
  storageUsed: number | null;
  storageLimit: number | null;
}> {
  const res = await driveFetch(
    `/about?fields=${encodeURIComponent("user(emailAddress),storageQuota(usage,limit)")}`,
  );
  if (!res.ok) throw new Error(`Drive about.get failed (${res.status})`);
  const json = (await res.json()) as {
    user?: { emailAddress?: string };
    storageQuota?: { usage?: string; limit?: string };
  };
  return {
    email: json.user?.emailAddress ?? null,
    storageUsed: json.storageQuota?.usage ? Number(json.storageQuota.usage) : null,
    storageLimit: json.storageQuota?.limit ? Number(json.storageQuota.limit) : null,
  };
}
