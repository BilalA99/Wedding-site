import "server-only";

import {
  createFolder,
  getFile,
  listChildren,
} from "@/lib/google/drive";
import {
  loadIntegration,
  saveIntegration,
  type GoogleDriveIntegrationData,
} from "@/lib/google/tokens";
import type { GuestbookEvent, GuestbookMediaType } from "@/lib/guestbook-shared";

export const ROOT_FOLDER_NAME = "Bilal & Jennah Wedding Guestbook";

const EVENT_FOLDER_NAMES: Record<GuestbookEvent, string> = {
  henna: "Henna",
  wedding: "Wedding",
  general: "General",
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function findOrCreateChildFolder(
  parentId: string | undefined,
  name: string,
): Promise<string> {
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const existing = parentId
    ? await listChildren(parentId, `name = '${escaped}' and mimeType = '${FOLDER_MIME}'`)
    : [];
  const first = existing[0];
  if (first) return first.id;
  const created = await createFolder(name, parentId);
  return created.id;
}

/**
 * Idempotent folder bootstrap. With drive.file scope the app can only see
 * folders it created, so the guestbook lives in its own dedicated root.
 * Discovered ids are persisted in app_integrations — later requests never
 * re-walk the tree.
 */
export async function ensureFolderStructure(): Promise<
  NonNullable<GoogleDriveIntegrationData["folders"]>
> {
  const { data } = await loadIntegration();

  // Fast path: all ids cached and the root still exists (not trashed).
  if (data.rootFolderId && data.folders && allEventsPresent(data.folders)) {
    return data.folders;
  }

  let rootId = data.rootFolderId;
  if (rootId) {
    const root = await getFile(rootId);
    if (!root || root.trashed) rootId = undefined;
  }
  if (!rootId) {
    // drive.file cannot search My Drive broadly; create our own root.
    const created = await createFolder(ROOT_FOLDER_NAME);
    rootId = created.id;
  }

  const folders: NonNullable<GoogleDriveIntegrationData["folders"]> = {};
  for (const event of Object.keys(EVENT_FOLDER_NAMES) as GuestbookEvent[]) {
    const eventId = await findOrCreateChildFolder(
      rootId,
      EVENT_FOLDER_NAMES[event],
    );
    const [videos, photos, thumbnails] = await Promise.all([
      findOrCreateChildFolder(eventId, "Videos"),
      findOrCreateChildFolder(eventId, "Photos"),
      findOrCreateChildFolder(eventId, "Thumbnails"),
    ]);
    folders[event] = { videos, photos, thumbnails };
  }

  await saveIntegration({
    rootFolderId: rootId,
    rootFolderName: ROOT_FOLDER_NAME,
    folders,
  });
  return folders;
}

function allEventsPresent(
  folders: NonNullable<GoogleDriveIntegrationData["folders"]>,
): boolean {
  return (Object.keys(EVENT_FOLDER_NAMES) as GuestbookEvent[]).every(
    (e) => folders[e]?.videos && folders[e]?.photos && folders[e]?.thumbnails,
  );
}

async function eventFolders(event: GuestbookEvent) {
  const folders = await ensureFolderStructure();
  const set = folders[event];
  if (!set) throw new Error(`Guestbook folders missing for event: ${event}`);
  return set;
}

/** Target folder id for a media upload. */
export async function folderFor(
  event: GuestbookEvent,
  mediaType: GuestbookMediaType,
): Promise<string> {
  const set = await eventFolders(event);
  return mediaType === "video" ? set.videos : set.photos;
}

export async function thumbnailFolderFor(
  event: GuestbookEvent,
): Promise<string> {
  const set = await eventFolders(event);
  return set.thumbnails;
}
