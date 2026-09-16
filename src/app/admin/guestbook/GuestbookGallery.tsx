"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { GuestbookEntry } from "@/lib/guestbook-service";
import {
  formatBytes,
  formatDuration,
  formatResolution,
  isLowResolution,
  type GuestbookEvent,
} from "@/lib/guestbook-shared";
import {
  deleteEntryAction,
  editEntryAction,
  restoreEntryAction,
  toggleFavoriteAction,
} from "./actions";

type Filter =
  | "all"
  | "messages"
  | "event_media"
  | "videos"
  | "photos"
  | "henna"
  | "wedding"
  | "general"
  | "favorites"
  | "deleted";

type Sort = "newest" | "oldest" | "largest";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "messages", label: "Messages" },
  { value: "event_media", label: "From Events" },
  { value: "videos", label: "Videos" },
  { value: "photos", label: "Photos" },
  { value: "henna", label: "Henna" },
  { value: "wedding", label: "Wedding" },
  { value: "general", label: "General" },
  { value: "favorites", label: "Favorites" },
  { value: "deleted", label: "Deleted" },
];

const EVENT_LABEL: Record<GuestbookEvent, string> = {
  henna: "Henna",
  wedding: "Wedding",
  general: "General",
};

export function GuestbookGallery({ entries }: { entries: GuestbookEntry[] }) {
  const reducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = entries.filter((e) =>
      filter === "deleted" ? e.status === "deleted" : e.status === "complete",
    );
    if (filter === "messages") list = list.filter((e) => e.kind === "message");
    if (filter === "event_media") {
      list = list.filter((e) => e.kind === "event_media");
    }
    if (filter === "videos") list = list.filter((e) => e.media_type === "video");
    if (filter === "photos") list = list.filter((e) => e.media_type === "photo");
    if (filter === "henna" || filter === "wedding" || filter === "general") {
      list = list.filter((e) => e.event_type === filter);
    }
    if (filter === "favorites") list = list.filter((e) => e.favorite);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        (e.guest_name ?? "anonymous").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "largest") return (b.file_size ?? 0) - (a.file_size ?? 0);
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === "oldest" ? diff : -diff;
    });
  }, [entries, filter, sort, search]);

  const open = openId ? entries.find((e) => e.id === openId) : null;

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setActionError(result.error ?? "Something went wrong.");
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`type-caps min-h-9 rounded-full px-3.5 py-1.5 text-[0.58rem] transition-colors ${
                filter === f.value
                  ? "bg-gold/15 text-gold-soft"
                  : "text-ivory/55 hover:text-ivory"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="gb-search" className="sr-only">
            Search by guest name
          </label>
          <input
            id="gb-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search names…"
            className="hairline min-h-9 w-40 rounded-full border bg-charcoal-soft/60 px-4 py-1.5 text-sm text-ivory placeholder:text-ivory/35 focus:border-gold/50 focus:outline-none"
          />
          <label htmlFor="gb-sort" className="sr-only">
            Sort
          </label>
          <select
            id="gb-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="hairline min-h-9 rounded-full border bg-charcoal-soft/60 px-3 py-1.5 text-sm text-ivory focus:border-gold/50 focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="largest">Largest</option>
          </select>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mt-4 text-sm text-thread-bright">
          {actionError}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="hairline mt-8 rounded-sm border bg-charcoal-soft/30 px-6 py-16 text-center">
          <p className="font-display text-xl text-ivory/80">No memories yet.</p>
          <p className="mt-2 text-sm text-ivory/45">
            {filter === "all"
              ? "Guestbook uploads will appear here as guests share them."
              : "Nothing matches this filter."}
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((entry) => (
            <li key={entry.id}>
              <EntryCard
                entry={entry}
                onOpen={() => setOpenId(entry.id)}
                onFavorite={() => run(() => toggleFavoriteAction(entry.id))}
                pending={pending}
              />
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {open && (
          <EntryModal
            key={open.id}
            entry={open}
            reducedMotion={!!reducedMotion}
            pending={pending}
            onClose={() => setOpenId(null)}
            onFavorite={() => run(() => toggleFavoriteAction(open.id))}
            onDelete={() =>
              run(async () => {
                const r = await deleteEntryAction(open.id);
                if (r.ok) setOpenId(null);
                return r;
              })
            }
            onRestore={() => run(() => restoreEntryAction(open.id))}
            onEdit={(payload) => run(() => editEntryAction(open.id, payload))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EntryCard({
  entry,
  onOpen,
  onFavorite,
  pending,
}: {
  entry: GuestbookEntry;
  onOpen: () => void;
  onFavorite: () => void;
  pending: boolean;
}) {
  const deleted = entry.status === "deleted";
  return (
    <div
      className={`hairline group relative overflow-hidden rounded-sm border bg-charcoal-soft/40 ${
        deleted ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        aria-label={`Open memory from ${entry.guest_name ?? "Anonymous"}`}
      >
        <div className="relative aspect-square bg-charcoal-mist/40">
          {deleted ? (
            <Placeholder label="Deleted" />
          ) : entry.drive_thumbnail_file_id || entry.media_type === "photo" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/admin/guestbook/${entry.id}/thumbnail`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <Placeholder label="Video" />
          )}
          {entry.media_type === "video" && !deleted && (
            <span className="absolute right-2 bottom-2 rounded-full bg-charcoal/75 px-2 py-0.5 text-[0.65rem] text-ivory/90">
              {entry.duration_seconds != null
                ? formatDuration(entry.duration_seconds)
                : "Video"}
            </span>
          )}
        </div>
        <div className="px-3 py-2.5">
          <p className="truncate text-sm text-ivory">
            {entry.guest_name ?? "Anonymous"}
          </p>
          <p className="type-caps mt-0.5 text-[0.52rem] text-sand/60">
            {entry.kind === "message" ? "Message" : EVENT_LABEL[entry.event_type]}{" "}
            ·{" "}
            {new Date(entry.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </button>
      {!deleted && (
        <button
          type="button"
          onClick={onFavorite}
          disabled={pending}
          aria-pressed={entry.favorite}
          aria-label={entry.favorite ? "Remove favorite" : "Mark favorite"}
          className={`absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-charcoal/70 transition-colors ${
            entry.favorite ? "text-gold-soft" : "text-ivory/60 hover:text-ivory"
          }`}
        >
          <HeartIcon filled={entry.favorite} className="h-4.5 w-4.5" />
        </button>
      )}
    </div>
  );
}

function EntryModal({
  entry,
  reducedMotion,
  pending,
  onClose,
  onFavorite,
  onDelete,
  onRestore,
  onEdit,
}: {
  entry: GuestbookEntry;
  reducedMotion: boolean;
  pending: boolean;
  onClose: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onEdit: (payload: {
    guestName?: string;
    message?: string;
    event: GuestbookEvent;
  }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(entry.guest_name ?? "");
  const [note, setNote] = useState(entry.message ?? "");
  const [event, setEvent] = useState<GuestbookEvent>(entry.event_type);
  const deleted = entry.status === "deleted";
  const mediaUrl = `/api/admin/guestbook/${entry.id}/media`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Memory from ${entry.guest_name ?? "Anonymous"}`}
      onClick={onClose}
    >
      <motion.div
        initial={reducedMotion ? {} : { scale: 0.96, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.3 }}
        className="hairline max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-sm border bg-charcoal-soft p-4 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl text-ivory">
              {entry.guest_name ?? "Anonymous"}
            </p>
            <p className="type-caps mt-1 text-[0.55rem] text-sand/70">
              {entry.kind === "message" ? "Message" : "Event media"} ·{" "}
              {EVENT_LABEL[entry.event_type]} · {entry.media_type} ·{" "}
              {entry.file_size != null ? formatBytes(entry.file_size) : "—"}
              {entry.duration_seconds != null &&
                ` · ${formatDuration(entry.duration_seconds)}`}
              {formatResolution(entry.video_width, entry.video_height) && (
                <>
                  {" · "}
                  <span
                    className={
                      isLowResolution(entry.video_width, entry.video_height)
                        ? "text-error"
                        : "text-sand"
                    }
                  >
                    {formatResolution(entry.video_width, entry.video_height)}
                  </span>
                </>
              )}{" "}
              ·{" "}
              {new Date(entry.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ivory/60 transition-colors hover:text-ivory"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {!deleted && (
          <div className="mt-4 overflow-hidden rounded-sm bg-charcoal">
            {entry.media_type === "video" ? (
              <video
                src={mediaUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-[55dvh] w-full object-contain"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={mediaUrl}
                alt={`Photo from ${entry.guest_name ?? "Anonymous"}`}
                className="max-h-[55dvh] w-full object-contain"
              />
            )}
          </div>
        )}

        {entry.message && !editing && (
          <p className="mt-4 border-l-2 border-gold/40 pl-3 text-sm text-ivory/85 italic">
            “{entry.message}”
          </p>
        )}

        {editing ? (
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              onEdit({
                guestName: name || undefined,
                message: note || undefined,
                event,
              });
              setEditing(false);
            }}
          >
            <div>
              <label htmlFor="edit-name" className="type-caps mb-1.5 block text-[0.55rem] text-sand/70">
                Guest name
              </label>
              <input
                id="edit-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                className="hairline w-full rounded-sm border bg-charcoal px-3 py-2.5 text-sm text-ivory focus:border-gold/50 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="edit-note" className="type-caps mb-1.5 block text-[0.55rem] text-sand/70">
                Message
              </label>
              <textarea
                id="edit-note"
                value={note}
                rows={2}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                className="hairline w-full resize-none rounded-sm border bg-charcoal px-3 py-2.5 text-sm text-ivory focus:border-gold/50 focus:outline-none"
              />
            </div>
            <div>
              <span className="type-caps mb-1.5 block text-[0.55rem] text-sand/70">
                Event
              </span>
              <div className="flex gap-1.5">
                {(Object.keys(EVENT_LABEL) as GuestbookEvent[]).map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => setEvent(ev)}
                    aria-pressed={event === ev}
                    className={`type-caps min-h-9 rounded-full px-3.5 py-1.5 text-[0.55rem] transition-colors ${
                      event === ev
                        ? "bg-gold/15 text-gold-soft"
                        : "text-ivory/55 hover:text-ivory"
                    }`}
                  >
                    {EVENT_LABEL[ev]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="type-caps rounded-full bg-gold/20 px-5 py-2.5 text-[0.6rem] text-gold-soft transition-colors hover:bg-gold/30 disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="type-caps px-4 py-2.5 text-[0.6rem] text-ivory/60 hover:text-ivory"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {!deleted && (
              <>
                <a
                  href={`${mediaUrl}?download=1`}
                  className="type-caps hairline rounded-full border px-4 py-2.5 text-[0.6rem] text-ivory/80 transition-colors hover:text-gold-soft"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={onFavorite}
                  disabled={pending}
                  aria-pressed={entry.favorite}
                  className={`type-caps hairline rounded-full border px-4 py-2.5 text-[0.6rem] transition-colors disabled:opacity-40 ${
                    entry.favorite
                      ? "text-gold-soft"
                      : "text-ivory/80 hover:text-gold-soft"
                  }`}
                >
                  {entry.favorite ? "♥ Favorited" : "♡ Favorite"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="type-caps hairline rounded-full border px-4 py-2.5 text-[0.6rem] text-ivory/80 transition-colors hover:text-gold-soft"
                >
                  Edit Details
                </button>
              </>
            )}
            <div className="ml-auto">
              {deleted ? (
                <button
                  type="button"
                  onClick={onRestore}
                  disabled={pending}
                  className="type-caps rounded-full border border-gold/40 px-4 py-2.5 text-[0.6rem] text-gold-soft disabled:opacity-40"
                >
                  Restore
                </button>
              ) : confirmDelete ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-ivory/60">Move to Drive Trash?</span>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={pending}
                    className="type-caps rounded-full bg-thread/30 px-4 py-2.5 text-[0.6rem] text-thread-bright disabled:opacity-40"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="type-caps px-2 py-2.5 text-[0.6rem] text-ivory/60"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="type-caps px-4 py-2.5 text-[0.6rem] text-ivory/50 transition-colors hover:text-thread-bright"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ivory/30">
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        <path d="M12 2 L22 12 L12 22 L2 12 Z" />
        <path d="M12 7 L17 12 L12 17 L7 12 Z" />
      </svg>
      <span className="type-caps text-[0.55rem]">{label}</span>
    </div>
  );
}

function HeartIcon({
  filled,
  className,
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.6 5 8.1 5c1.5 0 3 .7 3.9 1.9C12.9 5.7 14.4 5 15.9 5c2.5 0 4.6 2 4.6 4.6 0 3.7-3.5 6.9-8.5 10.9Z" />
    </svg>
  );
}
