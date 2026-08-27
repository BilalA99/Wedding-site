import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const sitePassword = process.env.SITE_PASSWORD;

  // ── Paths excluded from password protection (checked first) ─────────────
  // Must be before magic-link checks so ?token= on /api/* isn't intercepted.
  const excludedPaths = [
    '/_next', '/api', '/static', '/login', '/admin',
    '/legal', '/sms-optin-info', '/favicon.ico', '/images', '/audio', '/fonts', '/textures', '/videos',
    '/sms-opt-in-proof.jpg',
  ];

  if (excludedPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── /registry direct link: redirect to the hash before the auth gate ────
  // /registry/page.tsx itself does redirect('/#registry'), which the browser
  // turns into a second full navigation to "/" (fragments aren't sent to the
  // server). Since site-entry-granted is single-use, that second navigation
  // was consuming a fresh grant meant for THIS one, bouncing the guest back
  // to /login in a loop even right after they'd just logged in. Rewriting
  // the hash redirect here means only the second (already-normal) request to
  // "/" ever needs to pass the gate.
  if (pathname === '/registry') {
    return NextResponse.redirect(new URL('/#registry', request.url));
  }

  // ── Already authenticated: let them through regardless of query params ───
  const accessTokenEarly  = request.cookies.get('site-access-token')?.value;
  const entryGrantedEarly = request.cookies.get('site-entry-granted')?.value;
  if (sitePassword && accessTokenEarly === sitePassword && entryGrantedEarly === '1') {
    const res = NextResponse.next();
    res.cookies.delete('site-entry-granted');
    return res;
  }

  // ── Theme signal: ?view=final-invite ──────────────────────────────────────
  // Rides alongside either magic-link flow below; stamped as a cookie so
  // ViewProvider can read it on the next render regardless of which flow ran.
  const viewParam = searchParams.get('view');

  // ── Token-based magic link: ?token=<uuid> ────────────────────────────────
  // Opaque invite token — no password exposed in URL.
  const inviteToken = searchParams.get('token');
  if (inviteToken && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('token', inviteToken);
    if (viewParam) loginUrl.searchParams.set('view', viewParam);
    const res = NextResponse.redirect(loginUrl);
    // Magic links always pin an explicit theme, regardless of the site-wide
    // default — Save the Date guests must land on dark/RSVP even though the
    // site otherwise defaults to light for fresh/organic visits.
    res.cookies.set('view_pref', viewParam === 'final-invite' ? 'final-invite' : 'save-the-date', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return res;
  }

  // ── Path-based magic link: /i/<partyId> ──────────────────────────────────
  // Email links must never put a raw partyId (an all-hex UUID) directly after
  // an "=" — Resend's outgoing quoted-printable MIME encoding silently
  // corrupts any "=XY" where XY are hex digits (e.g. "partyId=78..." is
  // decoded by the receiving mail client as "partyIdx..."). Routing the UUID
  // through a path segment means it only ever sits next to "=" in this
  // server-issued redirect, never inside the emailed HTML itself.
  const pathPartyMatch = pathname.match(/^\/i\/([0-9a-fA-F-]{36})$/);
  if (pathPartyMatch && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('pwd', 'Matthew19:6');
    loginUrl.searchParams.set('partyId', pathPartyMatch[1]);
    if (viewParam) loginUrl.searchParams.set('view', viewParam);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.set('view_pref', viewParam === 'final-invite' ? 'final-invite' : 'save-the-date', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return res;
  }

  // ── Legacy magic link: ?pwd= or ?partyId= ────────────────────────────────
  const magicPwd = searchParams.get('pwd');
  const partyId  = searchParams.get('partyId');

  if (magicPwd || partyId) {
    if (pathname !== '/login') {
      const loginUrl = new URL('/login', request.url);
      if (magicPwd) loginUrl.searchParams.set('pwd', magicPwd);
      if (partyId) loginUrl.searchParams.set('partyId', partyId);
      if (viewParam) loginUrl.searchParams.set('view', viewParam);
      const res = NextResponse.redirect(loginUrl);
      // Same pin as the token-based branch above — legacy magic links must
      // not fall through to the site-wide light default.
      res.cookies.set('view_pref', viewParam === 'final-invite' ? 'final-invite' : 'save-the-date', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      return res;
    }
    // If already on /login, just let it through
  }

  // If no password is configured, allow access (development fallback)
  if (!sitePassword) {
    return NextResponse.next();
  }

  // ── Standard cookie-based auth ───────────────────────────────────────────
  const accessToken  = request.cookies.get('site-access-token')?.value;
  const entryGranted = request.cookies.get('site-entry-granted')?.value;

  // If we have the token AND just logged in (entryGranted), let them in
  // but delete the entry-granted signal so a refresh bounces them back to login.
  if (accessToken === sitePassword && entryGranted === '1') {
    const res = NextResponse.next();
    res.cookies.delete('site-entry-granted');
    return res;
  }

  // Otherwise, bounce to login. 
  // The login page will see 'site-access-token' and pre-fill the password.
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
