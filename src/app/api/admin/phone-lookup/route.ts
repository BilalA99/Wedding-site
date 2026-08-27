import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Temporary diagnostic tool: Twilio Lookup (caller_name package) to help
// attribute a party-level phone number to a specific person when our own
// data can't (guests.phone doesn't exist — see conversation with Yonatan,
// 2026-08-27). Not linked from any UI. Remove once no longer needed.
export async function POST(request: Request) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    const accessToken = (await cookies()).get('site-access-token')?.value;
    if (accessToken !== sitePassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { phones } = (await request.json()) as { phones: string[] };
  if (!Array.isArray(phones) || phones.length === 0) {
    return NextResponse.json({ error: 'phones array is required' }, { status: 400 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 });
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const results = await Promise.all(
    phones.map(async (phone) => {
      try {
        const res = await fetch(
          `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=caller_name,line_type_intelligence`,
          { headers: { Authorization: `Basic ${auth}` } }
        );
        const data = await res.json();
        return { phone, ok: res.ok, data };
      } catch (err) {
        return { phone, ok: false, error: String(err) };
      }
    })
  );

  return NextResponse.json({ results });
}
