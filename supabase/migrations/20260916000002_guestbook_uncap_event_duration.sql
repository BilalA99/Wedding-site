-- Event media is no longer capped at 15 minutes: a full speech, a whole first
-- dance, the entire zaffa. Drive has the room, so the product rule is gone and
-- the old 3600s check would now be the thing rejecting a long memory.
--
-- duration_seconds stays sanity-bounded rather than unbounded — it is client-
-- reported metadata, so a nonsense value should still be refused. 24h matches
-- the zod ceiling in guestbook-validation.ts.

alter table guestbook_entries
  drop constraint if exists guestbook_entries_duration_seconds_check;
alter table guestbook_entries
  add constraint guestbook_entries_duration_seconds_check
    check (
      duration_seconds is null
      or (duration_seconds >= 0 and duration_seconds <= 86400)
    );
