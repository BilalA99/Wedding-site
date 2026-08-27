import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import twilio from 'twilio';
import { RegistryPurchaseAlert } from '@/emails/RegistryPurchaseAlert';
import { RegistryGiftConfirmation } from '@/emails/RegistryGiftConfirmation';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yonatanestifanos58850@gmail.com';
const TWILIO_MESSAGING_SERVICE_SID = 'MG0851f4936a77e5efd5c0f1d4b69eed14';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export async function POST(request: Request) {
  try {
    // /api is excluded from the site-wide password gate in middleware.ts, so
    // this service-role write needs its own check — see undo-purchase/route.ts.
    const sitePassword = process.env.SITE_PASSWORD;
    if (sitePassword) {
      const accessToken = (await cookies()).get('site-access-token')?.value;
      if (accessToken !== sitePassword) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { id, name, email, phone, message } = body;

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: 'Name, email, and phone number are required' },
        { status: 400 }
      );
    }

    const normalizedPhone = toE164(phone.trim());

    // Update the registry item
    const { data, error } = await supabaseAdmin
      .from('registry_items')
      .update({
        is_purchased: true,
        purchaser_name: name.trim(),
        purchaser_email: email.trim(),
        purchaser_phone: phone.trim(),
        purchaser_message: message?.trim() || null,
      })
      .eq('id', id)
      .eq('is_purchased', false)
      .select()
      .single();

    if (error) {
      console.error('Error marking item as purchased:', error);
      return NextResponse.json({ error: 'Failed to mark item as purchased' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Item not found or already purchased' }, { status: 404 });
    }

    // Fetch shipping address for buyer confirmation
    const { data: settingRow } = await supabaseAdmin
      .from('site_settings')
      .select('value')
      .eq('key', 'shipping_address')
      .single();

    const addr = settingRow?.value as { line1?: string; city?: string; state?: string; zip?: string } | null;
    const shippingAddress = addr
      ? `${addr.line1}\n${addr.city}, ${addr.state} ${addr.zip}`
      : '474 Kelker St\nOberlin, PA 17113';

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Admin alert (non-blocking)
      render(
        React.createElement(RegistryPurchaseAlert, {
          itemName: data.name,
          itemPrice: data.price,
          purchaserName: name.trim(),
          purchaserEmail: email.trim(),
          purchaserPhone: phone.trim(),
          purchaserMessage: message?.trim() || undefined,
        })
      ).then((html) =>
        resend.emails.send({
          from: 'Yonatan & Saron (No Reply) <wedding@theestifanos.com>',
          to: ADMIN_EMAIL,
          subject: `🎁 Registry Gift: ${data.name} — from ${name.trim()}`,
          html,
        })
      ).catch((err) => console.error('Admin alert email failed (non-fatal):', err));

      // Buyer confirmation email
      render(
        React.createElement(RegistryGiftConfirmation, {
          purchaserName: name.trim(),
          itemName: data.name,
          shippingAddress,
        })
      ).then((html) =>
        resend.emails.send({
          from: 'Yonatan & Saron (No Reply) <wedding@theestifanos.com>',
          to: email.trim(),
          subject: `Thank you for your gift — Yonatan & Saron`,
          html,
        })
      ).catch((err) => console.error('Buyer confirmation email failed (non-fatal):', err));
    }

    // Buyer SMS confirmation
    if (!normalizedPhone) {
      console.error(`Buyer SMS confirmation skipped — unparseable phone number: "${phone.trim()}"`);
    } else if (normalizedPhone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );

        const smsBody = [
          `GIFT CONFIRMED — ${data.name}`,
          '',
          `God bless you, ${name.trim()}. We are so grateful for your generosity and love.`,
          '',
          'PLEASE SEND TO:',
          shippingAddress,
          '',
          "If you have any questions or need to reach us personally, don't hesitate — we're just a text or call away.",
          '',
          'With love,',
          'Yonatan & Saron · September 4, 2026',
          '',
          '---',
          'Msg & data rates may apply. Reply STOP to opt out.',
        ].join('\n');

        await twilioClient.messages.create({
          to: normalizedPhone,
          messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
          body: smsBody,
        });
      } catch (smsErr) {
        console.error('Buyer SMS confirmation failed (non-fatal):', smsErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Item marked as purchased',
      item: data,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
