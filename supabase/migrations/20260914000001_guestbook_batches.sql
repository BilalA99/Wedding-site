-- Guestbook lanes + batch dumps.
-- `kind` differentiates a video/photo MESSAGE to the couple from EVENT MEDIA
-- captured at the henna/wedding. `batch_id` groups the files a guest dumped
-- in one "Share Photos & Videos" session (name/message are copied onto every
-- row of the batch so each file stays self-describing).

alter table public.guestbook_entries
  add column if not exists kind text not null default 'message'
    check (kind in ('message', 'event_media')),
  add column if not exists batch_id uuid;

create index if not exists guestbook_batch_idx
  on public.guestbook_entries (batch_id) where batch_id is not null;
create index if not exists guestbook_kind_idx
  on public.guestbook_entries (kind) where status = 'complete';

-- Event-media clips can run longer than the 2-minute message rule.
alter table public.guestbook_entries
  drop constraint if exists guestbook_entries_duration_seconds_check;
alter table public.guestbook_entries
  add constraint guestbook_entries_duration_seconds_check
    check (duration_seconds is null or (duration_seconds >= 0 and duration_seconds <= 3600));
