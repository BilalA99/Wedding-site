import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { buildAuthUrl } from "@/lib/google/oauth";
import { siteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";

const STATE_COOKIE = "gb_oauth_state";

/** Admin-only: begins the Google Drive connection flow. */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/google/oauth",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthUrl(siteOrigin(), state));
}
