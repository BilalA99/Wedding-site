-- Records the intrinsic pixel dimensions of uploaded video, measured in the
-- browser before upload. Advisory only: nothing is ever rejected on these,
-- but they let the admin gallery show which memories arrived as compressed
-- copies (WhatsApp/Instagram exports land around 480p) versus camera
-- originals, and they make a quality regression visible instead of silent.

alter table guestbook_entries
  add column if not exists video_width integer,
  add column if not exists video_height integer;

alter table guestbook_entries
  drop constraint if exists guestbook_entries_video_width_check;
alter table guestbook_entries
  add constraint guestbook_entries_video_width_check
    check (video_width is null or (video_width > 0 and video_width <= 16384));

alter table guestbook_entries
  drop constraint if exists guestbook_entries_video_height_check;
alter table guestbook_entries
  add constraint guestbook_entries_video_height_check
    check (video_height is null or (video_height > 0 and video_height <= 16384));
