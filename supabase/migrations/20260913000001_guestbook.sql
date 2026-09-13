-- Google Drive video guestbook: metadata + integration secrets + audit.
-- Media bytes live in Google Drive; Supabase stores metadata only.
-- Same access model as the RSVP schema: all reads/writes go through the
-- Next.js server with the secret key. RLS enabled, no public policies.

-- ---------------------------------------------------------------------------
-- app_integrations: server-only integration state (Google Drive connection).
-- `data` holds non-secret state (account email, folder ids, timestamps).
-- `secret_ciphertext` holds the AES-256-GCM encrypted refresh token; the
-- encryption key lives only in the INTEGRATION_ENCRYPTION_KEY env var.
-- ---------------------------------------------------------------------------
create table if not exists public.app_integrations (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  secret_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- guestbook_entries: one row per guest submission (video or photo).
-- ---------------------------------------------------------------------------
create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  client_submission_id uuid not null unique,

  guest_name text check (guest_name is null or char_length(guest_name) <= 120),
  message text check (message is null or char_length(message) <= 500),

  event_type text not null check (event_type in ('henna', 'wedding', 'general')),
  media_type text not null check (media_type in ('video', 'photo')),

  drive_file_id text,
  drive_thumbnail_file_id text,
  drive_folder_id text,

  original_file_name text check (original_file_name is null or char_length(original_file_name) <= 255),
  stored_file_name text,
  mime_type text,

  file_size bigint check (file_size is null or file_size >= 0),
  duration_seconds integer check (duration_seconds is null or (duration_seconds >= 0 and duration_seconds <= 1200)),

  status text not null default 'pending'
    check (status in ('pending', 'uploading', 'complete', 'failed', 'deleted')),
  favorite boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create index if not exists guestbook_status_created_idx
  on public.guestbook_entries (status, created_at desc);
create index if not exists guestbook_event_idx
  on public.guestbook_entries (event_type) where status = 'complete';
create index if not exists guestbook_favorite_idx
  on public.guestbook_entries (favorite) where favorite;

-- ---------------------------------------------------------------------------
-- guestbook_audit_logs: mirrors rsvp_audit_logs for guestbook actions.
-- ---------------------------------------------------------------------------
create table if not exists public.guestbook_audit_logs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.guestbook_entries (id) on delete set null,
  actor_type text not null check (actor_type in ('guest', 'admin', 'system')),
  actor_identifier text,
  action text not null,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists guestbook_audit_entry_idx
  on public.guestbook_audit_logs (entry_id, created_at desc);
create index if not exists guestbook_audit_created_idx
  on public.guestbook_audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance (reuses set_updated_at() from the init migration)
-- ---------------------------------------------------------------------------
drop trigger if exists guestbook_entries_updated_at on public.guestbook_entries;
create trigger guestbook_entries_updated_at
  before update on public.guestbook_entries
  for each row execute function public.set_updated_at();

drop trigger if exists app_integrations_updated_at on public.app_integrations;
create trigger app_integrations_updated_at
  before update on public.app_integrations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: deny-by-default (no policies — only the service role reaches these).
-- ---------------------------------------------------------------------------
alter table public.app_integrations enable row level security;
alter table public.guestbook_entries enable row level security;
alter table public.guestbook_audit_logs enable row level security;
