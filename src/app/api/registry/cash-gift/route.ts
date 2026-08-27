import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import twilio from 'twilio';
import { CashGiftAlert } from '@/emails/CashGiftAlert';
import { CashGiftConfirmation } from '@/emails/CashGiftConfirmation';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yonatanestifanos58850@gmail.com';
const ADMIN_ALERT_PHONE = '+17179635535';
const TWILIO_MESSAGING_SERVICE_SID = 'MG0851f4936a77e5efd5c0f1d4b69eed14';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    // /api is excluded from the site-wide password gate in middleware.ts, so
    // this write needs its own check — see undo-purchase/route.ts.
    const sitePassword = process.env.SITE_PASSWORD;
    if (sitePassword) {
      const accessToken = (await cookies()).get('site-access-token')?.value;
      if (accessToken !== sitePassword) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { name, email, message, giftType } = body as {
      name: string;
      email?: string;
      message?: string;
      giftType: 'cashapp' | 'venmo' | 'zelle';
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!giftType || !['cashapp', 'venmo', 'zelle'].includes(giftType)) {
      return NextResponse.json({ error: 'Invalid gift type' }, { status: 400 });
    }

    const senderName = name.trim();
    const senderEmail = email?.trim() || undefined;
    const senderMessage = message?.trim() || undefined;

    // Record the gift note itself (source of truth) before touching email —
    // previously cash gifts left zero audit trail beyond a transient email.
    const supabaseAdmin = getSupabaseAdmin();
    const { error: insertError } = await supabaseAdmin.from('cash_gifts').insert({
      sender_name: senderName,
      sender_email: senderEmail || null,
      gift_type: giftType,
      message: senderMessage || null,
    });

    if (insertError) {
      console.error('Cash gift insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save gift note' }, { status: 500 });
    }

    // Notification emails are best-effort — the DB row above is what actually
    // records the gift, so an email hiccup shouldn't fail the guest's request
    // (matches mark-purchased's non-blocking pattern instead of hard-failing).
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const platform = giftType === 'cashapp' ? 'Cash App' : giftType === 'venmo' ? 'Venmo' : 'Zelle';

      render(
        React.createElement(CashGiftAlert, {
          giftType,
          senderName,
          senderEmail,
          message: senderMessage,
        })
      ).then((html) =>
        resend.emails.send({
          from: 'Yonatan & Saron (No Reply) <wedding@theestifanos.com>',
          to: ADMIN_EMAIL,
          subject: `💸 Cash Gift via ${platform} — ${senderName}`,
          html,
        })
      ).catch((err) => console.error('Cash gift admin alert failed (non-fatal):', err));

      if (senderEmail) {
        render(React.createElement(CashGiftConfirmation, { senderName }))
          .then((html) =>
            resend.emails.send({
              from: 'Yonatan & Saron (No Reply) <wedding@theestifanos.com>',
              to: senderEmail,
              subject: 'Thank you for your gift — Yonatan & Saron',
              html,
            })
          )
          .catch((err) => console.error('Cash gift sender confirmation failed (non-fatal):', err));
      }
    } else {
      console.error('RESEND_API_KEY is not set — cash gift notifications skipped');
    }

    // Admin SMS alert — mirrors the admin email alert above but hits your
    // phone immediately instead of waiting on email delivery/checking inbox.
    // Must be awaited: an un-awaited Twilio call can get cut off when a
    // Vercel serverless function returns its response before the request
    // finishes.
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const platform = giftType === 'cashapp' ? 'Cash App' : giftType === 'venmo' ? 'Venmo' : 'Zelle';
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const adminSmsBody = [
          `💸 Cash Gift Alert — via ${platform}`,
          `From: ${senderName}`,
          senderMessage ? `Note: "${senderMessage}"` : null,
        ].filter(Boolean).join('\n');

        await twilioClient.messages.create({
          to: ADMIN_ALERT_PHONE,
          messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
          body: adminSmsBody,
        });
      } catch (err) {
        console.error('Admin SMS alert failed (non-fatal):', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cash gift route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
