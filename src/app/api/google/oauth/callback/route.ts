import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

import { getAdminUser } from "@/lib/supabase/server-auth";
import {
  clearAccessTokenCache,
  exchangeCode,
  primeAccessToken,
} from "@/lib/google/oauth";
import { getAbout } from "@/lib/google/drive";
import { ensureFolderStructure } from "@/lib/google/folders";
import { saveIntegration } from "@/lib/google/tokens";
import { logGuestbookAudit } from "@/lib/guestbook-service";
import { siteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";

const STATE_COOKIE = "gb_oauth_state";
const RETURN_PATH = "/admin/integrations";

function redirectWith(param: string): NextResponse {
  return NextResponse.redirect(`${siteOrigin()}${RETURN_PATH}?${param}`);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.redirect(`${siteOrigin()}/admin/login`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (url.searchParams.get("error")) {
    return redirectWith("error=denied");
  }
  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return redirectWith("error=state");
  }

  try {
    const tokens = await exchangeCode(code, siteOrigin());

    if (!tokens.grantedScopes.includes("https://www.googleapis.com/auth/drive.file")) {
      return redirectWith("error=scope");
    }
    if (!tokens.refreshToken) {
      // Google withholds the refresh token if consent wasn't re-prompted.
      return redirectWith("error=norefresh");
    }

    clearAccessTokenCache();
    primeAccessToken(tokens.accessToken, tokens.expiresIn);

    // Persist the encrypted refresh token FIRST so Drive helpers can
    // recover even if folder bootstrap below fails transiently.
    await saveIntegration(
      {
        accountEmail: tokens.email ?? undefined,
        connectedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
        broken: false,
      },
      tokens.refreshToken,
    );

    const about = await getAbout();
    if (about.email && about.email !== tokens.email) {
      await saveIntegration({ accountEmail: about.email });
    }

    await ensureFolderStructure();

    await logGuestbookAudit({
      entry_id: null,
      actor_type: "admin",
      actor_identifier: admin,
      action: "google_drive_connected",
    });

    return redirectWith("connected=1");
  } catch (error) {
    console.error("google oauth callback failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return redirectWith("error=exchange");
  }
}
