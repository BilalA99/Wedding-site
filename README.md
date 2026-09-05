# Bilal Ahmad & Jennah Samhan — Wedding RSVP

A bespoke multi-event wedding invitation and RSVP experience for Bilal Ahmad &
Jennah Samhan's Henna (October 3, 2026 — Widdi Catering Hall, Brooklyn) and Wedding
(October 4, 2026 — Hilton Garden Inn, Staten Island).

Design language: white, airy, luxury-stationery editorial — Bodoni Moda +
Instrument Sans over a warm-paper / powder-blue palette derived from the
custom looping tatreez embroidery hero video (see docs/visual-system.md),
with a thread motif that runs from the hero through the events into the
RSVP envelope. Music starts on load (or on first tap where browsers block
autoplay).

## Stack

- **Next.js 16** (App Router, Server Components, server actions)
- **React 19**, **TypeScript** (strict)
- **Tailwind CSS 4** (tokenized theme in `src/app/globals.css`)
- **Motion** (Framer Motion successor) + **Lenis** smooth scrolling
- **Supabase** (Postgres + Auth) — free tier
- **Vercel** (Hobby) — $0/month infrastructure overall
- **Vitest** (unit) + **Playwright** (e2e)

## Architecture

```
Browser
  └── validated Next.js route handlers / server actions
        └── Supabase server client (secret key, server-only)
              └── Postgres with RLS deny-by-default + SECURITY DEFINER RPCs
```

- The browser never talks to the database. All tables have RLS enabled with
  **no** public policies; reads/writes go through `src/lib/rsvp-service.ts`
  using the secret key.
- RSVP creation/update/delete are **atomic Postgres functions**
  (`submit_rsvp`, `update_rsvp`, `delete_rsvp`) so a party, its per-event
  responses, optional member names, and the audit log commit together.
- **Idempotency**: every submission carries a client-generated UUID; retries
  return the original result instead of duplicating rows.
- **Manage tokens**: guests get a `/rsvp/manage/<token>` link. Tokens are
  32 random bytes; only the SHA-256 hash is stored.
- **Multi-event model**: attendance and party size live in
  `party_event_responses` (one row per party per event) — Henna and Wedding
  counts are fully independent.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

### Environment variables

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe key (admin auth only) |
| `SUPABASE_SECRET_KEY` | Server-only data access — never exposed |
| `ADMIN_EMAILS` | Comma-separated emails allowed into `/admin` |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (production domain on Vercel) |

## Database

Schema lives in `supabase/migrations/`. Apply with the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

(or paste the migration into the Supabase SQL editor — it is idempotent).
Seeds both events and default `app_settings`.

## Admin

- `/admin` — overview (per-event guest totals, parties, declines, both-events
  count, recent activity)
- `/admin/rsvps` — search, filters, duplicate detection, edit/delete with
  audit history
- `/admin/activity` — full audit log
- `/admin/invitations` — household list + CSV import (groundwork for
  controlled-invitation mode; open RSVP is the launch mode)
- CSV export from the header

Sign-in: email OTP via Supabase Auth. Only addresses in `ADMIN_EMAILS` pass
the middleware + server-side checks. The admin keeps its own dark
professional theme, separate from the public visual system.

## Music

The track lives at `public/audio/wedding-theme.mp3`. It attempts to play the
moment the page loads; where the browser blocks audible autoplay, the first
tap/click/keypress anywhere starts it. Volume fades in to ~0.3, an explicit
pause is remembered for the session, and the site still works with no file —
the sound controller hides itself if audio can't load.

## Testing

```bash
npm run typecheck
npm run lint
npm run test        # Vitest unit suite
npm run test:e2e    # Playwright (needs a provisioned database)
```

## Deployment (Vercel)

```bash
npx vercel link
npx vercel deploy          # preview
npx vercel deploy --prod   # production
```

Set the environment variables above for Production + Preview, then update
`NEXT_PUBLIC_SITE_URL` to the real production URL and redeploy.

## Licenses

MIT. This repository began as a fork of
[Forkuku](https://github.com/gimbalzero/Forkuku) (MIT) — see `LICENSE` and
`THIRD_PARTY_NOTICES.md`. The current application is a ground-up rebuild; the
original is preserved on branch `checkpoint/forkuku-original`.
