import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/supabase/server-auth";
import { listParties } from "@/lib/admin-service";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parties = await listParties();

  const csv = toCsv(
    [
      "primary_name",
      "email",
      "phone",
      "henna_attending",
      "henna_party_size",
      "wedding_attending",
      "wedding_party_size",
      "guest_names",
      "message",
      "created_at",
      "updated_at",
    ],
    parties.map((p) => [
      p.primary_name,
      p.email ?? "",
      p.phone ?? "",
      p.responses.henna ? (p.responses.henna.attending ? "yes" : "no") : "",
      p.responses.henna?.party_size ?? "",
      p.responses.wedding ? (p.responses.wedding.attending ? "yes" : "no") : "",
      p.responses.wedding?.party_size ?? "",
      p.member_names.join("; "),
      p.message ?? "",
      p.created_at,
      p.updated_at,
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bilal-jennah-rsvps.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
