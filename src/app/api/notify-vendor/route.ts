import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase';
import { VendorWelcome } from '@/emails/VendorWelcome';
import { VendorDayBefore } from '@/emails/VendorDayBefore';

const SITE_LINK = 'https://theestifanos.com/?pwd=Matthew19:6&view=final-invite';
const COMPLIANCE = 'Msg & data rates may apply. Reply STOP to opt out.';

export async function POST(req: Request) {
  try {
    const { vendorId, channel, type } = await req.json();
    const messageType: 'welcome' | 'day-before' = type === 'day-before' ? 'day-before' : 'welcome';

    if (!vendorId) {
      return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
    }

    const sendEmail = !channel || channel === 'email';
    const sendSms = !channel || channel === 'sms';

    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialised — SUPABASE_SERVICE_ROLE_KEY missing');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .select('id, name, phone, email')
      .eq('id', vendorId)
      .single();

    if (vendorError || !vendor) {
      console.error('Vendor fetch error:', vendorError);
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const results: { channel: string; status: string }[] = [];

    if (sendEmail && vendor.email) {
      if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY is not set');
      } else {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = messageType === 'day-before'
          ? await render(React.createElement(VendorDayBefore, { vendorName: vendor.name }))
          : await render(React.createElement(VendorWelcome, { vendorName: vendor.name }));
        const subject = messageType === 'day-before'
          ? 'See You Tomorrow — Yonatan & Saron'
          : "We're So Excited to Have You! — Yonatan & Saron";
        const { error: emailError } = await resend.emails.send({
          from: 'Yonatan & Saron (No Reply) <wedding@theestifanos.com>',
          to: vendor.email,
          subject,
          html,
        });
        results.push({ channel: 'email', status: emailError ? 'failed' : 'sent' });
        if (emailError) console.error(`Resend error for ${vendor.email}:`, emailError);
      }
    }

    if (sendSms && vendor.phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const smsBody = messageType === 'day-before'
        ? [
            `Hi ${vendor.name}!`,
            '',
            "We are SO excited for tomorrow — it's really happening!",
            '',
            "Quick heads up: we're expecting a bit of rain throughout the day. Just in case, please plan accordingly. We'll keep you posted if anything changes.",
            '',
            'See our site:',
            SITE_LINK,
            '',
            'Questions or day-of issues?',
            'Yonatan — 717-963-5535',
            'Saron — 240-694-5559',
            '',
            'Day-of point of contact:',
            'Elsa Guta — 510-328-0055',
            '',
            '— Yonatan & Saron',
            '',
            COMPLIANCE,
          ].join('\n')
        : [
            `Hi ${vendor.name}!`,
            '',
            "We're so excited to have you as part of our wedding on September 4, 2026. Check out our website to get to know us and our story:",
            SITE_LINK,
            '',
            'Questions before the day?',
            'Yonatan — 717-963-5535',
            'Saron — 240-694-5559',
            '',
            'Day-of point of contact:',
            'Elsa Guta — 510-328-0055',
            'Elisabethsenbeta@gmail.com',
            '',
            '— Yonatan & Saron',
            '',
            COMPLIANCE,
          ].join('\n');

      try {
        await twilioClient.messages.create({
          to: vendor.phone,
          messagingServiceSid: 'MG0851f4936a77e5efd5c0f1d4b69eed14',
          body: smsBody,
        });
        results.push({ channel: 'sms', status: 'sent' });
      } catch (smsErr) {
        console.error(`Twilio error for ${vendor.phone}:`, smsErr);
        results.push({ channel: 'sms', status: 'failed' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('Vendor notify API unhandled error:', err);
    return NextResponse.json({ error: 'Failed to send vendor notification' }, { status: 500 });
  }
}
