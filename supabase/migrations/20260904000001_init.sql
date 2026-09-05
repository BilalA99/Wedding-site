-- Bilal & Jennah wedding RSVP schema
-- Multi-event RSVP: attendance and party size are tracked PER EVENT.
-- All access goes through the Next.js server using the Supabase secret key;
-- RLS is enabled everywhere with no public policies (deny-by-default).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  event_date date not null,
  start_time time not null,
  timezone text not null default 'America/New_York',
  venue_name text not null,
  address_line_1 text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- app_settings (key/value configuration)
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- households + invited guests (controlled-invitation mode; dormant at launch)
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 200),
  invite_token_hash text unique,
  max_party_size int not null default 10 check (max_party_size between 1 and 50),
  allow_plus_one boolean not null default false,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invited_guests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null default '' check (char_length(last_name) <= 100),
  nickname text,
  guest_type text not null default 'adult' check (guest_type in ('adult', 'child', 'plus_one')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invited_guest_events (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.invited_guests (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  is_invited boolean not null default true,
  unique (guest_id, event_id)
);

-- ---------------------------------------------------------------------------
-- rsvp_parties: one submission (open mode) or household response (invite mode)
-- ---------------------------------------------------------------------------
create table if not exists public.rsvp_parties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete set null,
  primary_name text not null check (char_length(primary_name) between 1 and 120),
  normalized_name text not null,
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  message text check (message is null or char_length(message) <= 2000),
  source text not null default 'open' check (source in ('open', 'invite', 'admin')),
  manage_token_hash text not null unique,
  client_submission_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rsvp_parties_normalized_name_idx on public.rsvp_parties (normalized_name);
create index if not exists rsvp_parties_email_idx on public.rsvp_parties (lower(email)) where email is not null;

-- ---------------------------------------------------------------------------
-- party_event_responses: THE headcount table. One row per party per event.
-- ---------------------------------------------------------------------------
create table if not exists public.party_event_responses (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.rsvp_parties (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  attending boolean not null,
  party_size int not null default 0 check (party_size >= 0 and party_size <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (party_id, event_id),
  constraint party_size_matches_attendance
    check ((attending and party_size >= 1) or ((not attending) and party_size = 0))
);

create index if not exists per_event_attending_idx on public.party_event_responses (event_id, attending);

-- ---------------------------------------------------------------------------
-- party_members: optional guest names supplied in open mode
-- ---------------------------------------------------------------------------
create table if not exists public.party_members (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.rsvp_parties (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create index if not exists party_members_party_idx on public.party_members (party_id);

-- ---------------------------------------------------------------------------
-- rsvp_audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.rsvp_audit_logs (
  id uuid primary key default gen_random_uuid(),
  party_id uuid references public.rsvp_parties (id) on delete set null,
  actor_type text not null check (actor_type in ('guest', 'admin', 'system')),
  actor_identifier text,
  action text not null,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_party_idx on public.rsvp_audit_logs (party_id, created_at desc);
create index if not exists audit_created_idx on public.rsvp_audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['events', 'app_settings', 'households', 'invited_guests', 'rsvp_parties', 'party_event_responses']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: deny-by-default. No policies on purpose — every read and
-- write flows through the Next.js server which uses the secret (service) key.
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.app_settings enable row level security;
alter table public.households enable row level security;
alter table public.invited_guests enable row level security;
alter table public.invited_guest_events enable row level security;
alter table public.rsvp_parties enable row level security;
alter table public.party_event_responses enable row level security;
alter table public.party_members enable row level security;
alter table public.rsvp_audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Aggregate view for admin dashboards (server-only: revoke public access)
-- ---------------------------------------------------------------------------
create or replace view public.event_attendance_summary
with (security_invoker = off) as
select
  e.id as event_id,
  e.slug,
  e.name,
  count(r.id) filter (where r.attending) as parties_attending,
  count(r.id) filter (where not r.attending) as parties_declined,
  coalesce(sum(r.party_size) filter (where r.attending), 0)::int as guests_attending
from public.events e
left join public.party_event_responses r on r.event_id = e.id
group by e.id, e.slug, e.name;

revoke all on public.event_attendance_summary from anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_rsvp: atomic create of party + per-event responses + members + audit.
-- Idempotent on client_submission_id: retries return the original result.
-- ---------------------------------------------------------------------------
create or replace function public.submit_rsvp(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.rsvp_parties%rowtype;
  v_party_id uuid;
  v_resp jsonb;
  v_member text;
  v_event_id uuid;
  v_new_state jsonb;
begin
  -- Idempotency: same client submission id => return the already-created party.
  select * into v_existing
  from public.rsvp_parties
  where client_submission_id = (payload ->> 'client_submission_id')::uuid;

  if found then
    return jsonb_build_object('party_id', v_existing.id, 'created', false);
  end if;

  insert into public.rsvp_parties
    (primary_name, normalized_name, email, phone, message, source, manage_token_hash, client_submission_id)
  values
    (payload ->> 'primary_name',
     payload ->> 'normalized_name',
     nullif(payload ->> 'email', ''),
     nullif(payload ->> 'phone', ''),
     nullif(payload ->> 'message', ''),
     coalesce(payload ->> 'source', 'open'),
     payload ->> 'manage_token_hash',
     (payload ->> 'client_submission_id')::uuid)
  returning id into v_party_id;

  for v_resp in select * from jsonb_array_elements(payload -> 'responses')
  loop
    select id into v_event_id from public.events where slug = v_resp ->> 'event_slug';
    if v_event_id is null then
      raise exception 'unknown event slug %', v_resp ->> 'event_slug';
    end if;

    insert into public.party_event_responses (party_id, event_id, attending, party_size)
    values (v_party_id, v_event_id, (v_resp ->> 'attending')::boolean, (v_resp ->> 'party_size')::int);
  end loop;

  for v_member in select value #>> '{}' from jsonb_array_elements(coalesce(payload -> 'member_names', '[]'::jsonb))
  loop
    if char_length(trim(v_member)) > 0 then
      insert into public.party_members (party_id, name) values (v_party_id, trim(v_member));
    end if;
  end loop;

  v_new_state := jsonb_build_object(
    'primary_name', payload ->> 'primary_name',
    'responses', payload -> 'responses',
    'member_names', coalesce(payload -> 'member_names', '[]'::jsonb)
  );

  insert into public.rsvp_audit_logs (party_id, actor_type, actor_identifier, action, new_state)
  values (v_party_id, 'guest', null, 'created', v_new_state);

  return jsonb_build_object('party_id', v_party_id, 'created', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- update_rsvp: atomic update of party fields + per-event responses + members,
-- with an audit record capturing before/after. Used by guests (via manage
-- token, resolved server-side) and by admins (actor_type = 'admin').
-- ---------------------------------------------------------------------------
create or replace function public.update_rsvp(p_party_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_state jsonb;
  v_new_state jsonb;
  v_resp jsonb;
  v_event_id uuid;
begin
  select jsonb_build_object(
    'primary_name', p.primary_name,
    'email', p.email,
    'phone', p.phone,
    'message', p.message,
    'responses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event_slug', e.slug, 'attending', r.attending, 'party_size', r.party_size
      ) order by e.display_order), '[]'::jsonb)
      from public.party_event_responses r
      join public.events e on e.id = r.event_id
      where r.party_id = p.id
    ),
    'member_names', (
      select coalesce(jsonb_agg(m.name order by m.created_at), '[]'::jsonb)
      from public.party_members m where m.party_id = p.id
    )
  )
  into v_prev_state
  from public.rsvp_parties p
  where p.id = p_party_id;

  if v_prev_state is null then
    raise exception 'party % not found', p_party_id;
  end if;

  update public.rsvp_parties
  set primary_name = coalesce(payload ->> 'primary_name', primary_name),
      normalized_name = coalesce(payload ->> 'normalized_name', normalized_name),
      email = case when payload ? 'email' then nullif(payload ->> 'email', '') else email end,
      phone = case when payload ? 'phone' then nullif(payload ->> 'phone', '') else phone end,
      message = case when payload ? 'message' then nullif(payload ->> 'message', '') else message end
  where id = p_party_id;

  if payload ? 'responses' then
    for v_resp in select * from jsonb_array_elements(payload -> 'responses')
    loop
      select id into v_event_id from public.events where slug = v_resp ->> 'event_slug';
      if v_event_id is null then
        raise exception 'unknown event slug %', v_resp ->> 'event_slug';
      end if;

      insert into public.party_event_responses (party_id, event_id, attending, party_size)
      values (p_party_id, v_event_id, (v_resp ->> 'attending')::boolean, (v_resp ->> 'party_size')::int)
      on conflict (party_id, event_id)
      do update set attending = excluded.attending, party_size = excluded.party_size;
    end loop;
  end if;

  if payload ? 'member_names' then
    delete from public.party_members where party_id = p_party_id;
    insert into public.party_members (party_id, name)
    select p_party_id, trim(value #>> '{}')
    from jsonb_array_elements(payload -> 'member_names')
    where char_length(trim(value #>> '{}')) > 0;
  end if;

  select jsonb_build_object(
    'primary_name', p.primary_name,
    'email', p.email,
    'phone', p.phone,
    'message', p.message,
    'responses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event_slug', e.slug, 'attending', r.attending, 'party_size', r.party_size
      ) order by e.display_order), '[]'::jsonb)
      from public.party_event_responses r
      join public.events e on e.id = r.event_id
      where r.party_id = p.id
    ),
    'member_names', (
      select coalesce(jsonb_agg(m.name order by m.created_at), '[]'::jsonb)
      from public.party_members m where m.party_id = p.id
    )
  )
  into v_new_state
  from public.rsvp_parties p
  where p.id = p_party_id;

  insert into public.rsvp_audit_logs (party_id, actor_type, actor_identifier, action, previous_state, new_state)
  values (
    p_party_id,
    coalesce(payload ->> 'actor_type', 'guest'),
    payload ->> 'actor_identifier',
    coalesce(payload ->> 'action', 'guest_updated'),
    v_prev_state,
    v_new_state
  );

  return jsonb_build_object('party_id', p_party_id, 'updated', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_rsvp: admin-only removal, preserving an audit trail.
-- ---------------------------------------------------------------------------
create or replace function public.delete_rsvp(p_party_id uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_state jsonb;
begin
  select jsonb_build_object(
    'primary_name', p.primary_name,
    'email', p.email,
    'phone', p.phone,
    'responses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event_slug', e.slug, 'attending', r.attending, 'party_size', r.party_size
      )), '[]'::jsonb)
      from public.party_event_responses r
      join public.events e on e.id = r.event_id
      where r.party_id = p.id
    )
  )
  into v_prev_state
  from public.rsvp_parties p
  where p.id = p_party_id;

  if v_prev_state is null then
    raise exception 'party % not found', p_party_id;
  end if;

  insert into public.rsvp_audit_logs (party_id, actor_type, actor_identifier, action, previous_state)
  values (p_party_id, 'admin', p_actor, 'admin_deleted', v_prev_state);

  delete from public.rsvp_parties where id = p_party_id;

  return jsonb_build_object('party_id', p_party_id, 'deleted', true);
end;
$$;

-- Lock RPCs down to the service role only.
revoke execute on function public.submit_rsvp(jsonb) from public, anon, authenticated;
revoke execute on function public.update_rsvp(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_rsvp(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_rsvp(jsonb) to service_role;
grant execute on function public.update_rsvp(uuid, jsonb) to service_role;
grant execute on function public.delete_rsvp(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Seed data (idempotent)
-- ---------------------------------------------------------------------------
insert into public.events
  (slug, name, event_date, start_time, timezone, venue_name, address_line_1, city, state, postal_code, display_order)
values
  ('henna', 'Henna', '2026-10-03', '19:00', 'America/New_York',
   'Widdi Catering Hall', '5602 6th Ave', 'Brooklyn', 'NY', '11220', 1),
  ('wedding', 'Wedding', '2026-10-04', '19:00', 'America/New_York',
   'Hilton Garden Inn New York/Staten Island', '1100 South Ave', 'Staten Island', 'NY', '10314', 2)
on conflict (slug) do update set
  name = excluded.name,
  event_date = excluded.event_date,
  start_time = excluded.start_time,
  timezone = excluded.timezone,
  venue_name = excluded.venue_name,
  address_line_1 = excluded.address_line_1,
  city = excluded.city,
  state = excluded.state,
  postal_code = excluded.postal_code,
  display_order = excluded.display_order;

insert into public.app_settings (key, value)
values
  ('rsvp_mode', '"open"'::jsonb),
  ('rsvp_open', 'true'::jsonb),
  ('rsvp_deadline', 'null'::jsonb),
  ('max_open_party_size', '12'::jsonb)
on conflict (key) do nothing;
