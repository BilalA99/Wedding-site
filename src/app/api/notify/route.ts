import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase';
import { getCampaign } from '@/config/campaigns';
import { FormalInvite } from '@/emails/FormalInvite';
import { SaveTheDate } from '@/emails/SaveTheDate';
import { PhotoSaveTheDate } from '@/emails/PhotoSaveTheDate';
import { GenericTemplate } from '@/emails/GenericTemplate';
import { PartialRsvpNudge } from '@/emails/PartialRsvpNudge';
import { DeclinedRegistry } from '@/emails/DeclinedRegistry';

const SUBJECTS: Record<string, string> = {
  'save-the-date':       'Save the Date — Yonatan & Saron · September 4, 2026',
  'save-the-date-48hr':  'Can You Confirm? — Yonatan & Saron · September 4, 2026',
  'formal-invitation':   'You are invited to the wedding of Yonatan & Saron',
  'partial-rsvp-nudge':  'One More RSVP Needed — Yonatan & Saron',
  'declined-registry':   "We'll Miss You — Our Story & Registry · Yonatan & Saron",
  'rsvp-reminder':       'Reminder: RSVP by June 15th — Yonatan & Saron',
  'logistics-update':    'Wedding Week Details — Yonatan & Saron',
  'day-before-alert':    "Tomorrow's the Day — Weather Update · Yonatan & Saron",
  'day-of-alert':        'Day-of Update — Yonatan & Saron',
  'thank-you':           'Thank You — Yonatan & Saron',
};

function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

const BASE_URL = 'https://theestifanos.com';
const PWD = 'Matthew19:6';
const COMPLIANCE = 'You are subscribed to receive wedding updates. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.';

function buildSmsBody(campaignId: string, guestName: string, partyId: string, inviteToken?: string): string {
  const viewSuffix = campaignId === 'formal-invitation' || campaignId === 'declined-registry' ? '&view=final-invite' : '';
  // The 48hr variant jumps straight to #rsvp — the original Save the Date
  // link is unchanged since it stays byte-identical to its send history.
  const hashSuffix = campaignId === 'save-the-date-48hr' ? '#rsvp' : '';
  const magicLink = (inviteToken
    ? `${BASE_URL}/?token=${inviteToken}${viewSuffix}`
    : `${BASE_URL}/?pwd=${PWD}&partyId=${partyId}${viewSuffix}`) + hashSuffix;

  switch (campaignId) {
    case 'save-the-date':
      return [
        'SAVE THE DATE',
        '',
        'Yonatan & Saron',
        'SEPTEMBER 4, 2026',
        'WRIGHTSVILLE, PENNSYLVANIA',
        '',
        `${guestName},`,
        '',
        "We are overjoyed to invite you to celebrate the beginning of our forever. God has been so faithful in bringing us together, and we couldn't imagine stepping into this marriage covenant without our favorite people in the room. To receive your formal invitation with the exact location and weekend details, please register your attendance on our website by June 15th.",
        '',
        `RSVP: ${magicLink}`,
        '',
        '---',
        COMPLIANCE,
      ].join('\n');

    case 'save-the-date-48hr':
      return [
        'SAVE THE DATE',
        '',
        'Yonatan & Saron',
        'SEPTEMBER 4, 2026',
        'WRIGHTSVILLE, PENNSYLVANIA',
        '',
        `${guestName},`,
        '',
        "We are overjoyed to invite you to celebrate the beginning of our forever. God has been so faithful in bringing us together, and we couldn't imagine stepping into this marriage covenant without our favorite people in the room. To receive your formal invitation with the exact location and weekend details, please register your attendance on our website by June 15th.",
        '',
        'Can you confirm in the next 48 hours?',
        `RSVP: ${magicLink}`,
        '',
        '---',
        COMPLIANCE,
      ].join('\n');

    case 'formal-invitation':
      return [
        'FORMAL INVITATION',
        '',
        'Yonatan & Saron',
        'SEPTEMBER 4, 2026  ·  WRIGHTSVILLE, PA',
        '',
        `Dear ${guestName},`,
        '',
        "With joyful hearts and overwhelming gratitude for what the Lord has done, we are so excited to invite you to celebrate our marriage.",
        '',
        "Your love, prayers, and support have deeply shaped our story. From the long-distance days to the quiet moments of faith that brought us here, you have been our village. We truly cannot imagine stepping into this next chapter without you by our side.",
        '',
        'Japanese Garden',
        'Ceremony at Lauxmont Gardens',
        '1155 Long Level Road, Wrightsville, PA 17368',
        'Guests welcomed at 2:30 PM  ·  Ceremony at 3:00 PM',
        '',
        `See Our Story & Details: ${magicLink}`,
        `Registry (Cash App, Venmo & Zelle): ${magicLink}#registry`,
        `Add to Calendar: ${BASE_URL}/api/calendar`,
        '',
        '---',
        COMPLIANCE,
      ].join('\n');

    case 'declined-registry':
      return [
        'FROM YONATAN & SARON',
        '',
        `${guestName},`,
        '',
        "We were recently notified you won't be able to join us on September 4, 2026 — we completely understand, and we'll miss you.",
        '',
        "We'd still love for you to feel close to our story — come take a look:",
        magicLink,
        '',
        `Registry: ${magicLink}#registry`,
        '',
        '---',
        COMPLIANCE,
      ].join('\n');

    case 'rsvp-reminder':
      return [
        'RSVP REMINDER',
        '',
        `${guestName},`,
        '',
        `This is a friendly reminder to RSVP for Yonatan & Saron's wedding by June 15th, 2026. We'd love to know if you can make it!`,
        '',
        `RSVP here: ${magicLink}`,
        '',
        '---',
        COMPLIANCE,
      ].join('\n');

    case 'logistics-update':
      return [
        'WEDDING WEEK DETAILS',
        '',
        'Yonatan & Saron · September 4, 2026',
        '',
        `${guestName},`,
        '',
        "Here are the details you'll need for the big weekend. Visit our website for parking, hotel accommodations, and the full day-of schedule.",
        '',
        `Details: ${magicLink}`,
        '',
        '---',
        COMPLIANCE,
      ].join('\n');

    case 'day-before-alert':
      return [
        'THE DAY BEFORE!',
        '',
        'Yonatan & Saron',
        '',
        `${guestName},`,
        '',
        "We are SO excited to celebrate with you tomorrow — it's really happening!",
        '',
        "One quick heads up: we're expecting a bit of rain throughout the day. Just in case, we'd recommend bringing a poncho for the ceremony. We'll keep you posted if anything changes.",
        '',
        `See you tomorrow: ${magicLink}`,
        '',
        '---',
        COMPLIANCE,
      ].join('\n');

    case 'day-of-alert':
      return [
        'TODAY IS THE DAY!',
        '',
        "We're so excited to celebrate with you today! Check our website for any last-minute updates.",
        '',
        `Updates: ${magicLink}`,
        '',
        '---',
        COMPLIANCE,
      ].join('\n');

    case 'thank-you':
      return [
        'THANK YOU',
        '',
        `${guestName},`,
        '',
        "Thank you so much for celebrating our wedding with us. Your presence, love, and support meant everything. We are so grateful to have you in our lives.",
        '',
        '— Yonatan & Saron',
        '',
        '---',
        COMPLIANCE,
      ].join('\n');

    default:
      return `Update from Yonatan & Saron. Visit: ${magicLink}\n\n---\n${COMPLIANCE}`;
  }
}

function buildAlreadyRsvpedSmsBody(
  guestName: string,
  partyId: string,
  attending: string[],
  declined: string[],
  inviteToken?: string
): string {
  const magicLink = inviteToken
    ? `${BASE_URL}/?token=${inviteToken}`
    : `${BASE_URL}/?pwd=${PWD}&partyId=${partyId}`;
  const hasAttending = attending.length > 0;

  if (hasAttending) {
    const lines = [
      'RSVP CONFIRMED',
      '',
      "We can't wait to celebrate with you.",
      '',
      'Thank you for confirming your attendance. We are currently preparing your formal invitation suite, which will include the venue location, day-of details, and our full weekend itinerary. We will reach out to your party soon with these final details.',
      '',
      'ATTENDING:',
      ...attending,
    ];

    if (declined.length > 0) {
      lines.push('');
      lines.push('NOT ATTENDING:');
      declined.forEach(name => lines.push(name));
    }

    lines.push(
      '',
      'THE PRAYER REQUEST',
      "More than anything, as we prepare to enter into this marriage covenant, our greatest request is your continued prayers. Please join us in praying over our relationship, our future together, and the beautiful day ahead.",
      '',
      'Yonatan & Saron · September 4, 2026',
      '',
      '---',
      COMPLIANCE
    );

    return lines.join('\n');
  } else {
    return [
      'RSVP DECLINED',
      '',
      'Yonatan & Saron',
      '',
      "Got it — we've marked you as unable to join us on September 4, 2026. We'll miss you, and thank you for letting us know!",
      '',
      'Changed your mind? Update here:',
      magicLink,
      '',
      '---',
      COMPLIANCE,
    ].join('\n');
  }
}

function buildPartialRsvpNudgeSmsBody(
  acceptedNames: string[],
  pendingNames: string[],
  partyId: string,
  inviteToken?: string
): string {
  const magicLink = (inviteToken
    ? `${BASE_URL}/?token=${inviteToken}`
    : `${BASE_URL}/?pwd=${PWD}&partyId=${partyId}`) + '#rsvp';

  const acceptedText = joinNames(acceptedNames);
  const pendingText = joinNames(pendingNames);
  const intro = acceptedText
    ? `${acceptedText} ${acceptedNames.length === 1 ? 'is' : 'are'} confirmed for our wedding on September 4, 2026`
    : 'Your party is confirmed for our wedding on September 4, 2026';

  return [
    'RSVP UPDATE',
    '',
    'Yonatan & Saron',
    '',
    `${intro} — but we haven't heard from ${pendingText} yet.`,
    '',
    `Can you confirm ${pendingText}'s RSVP within the next 48 hours?`,
    '',
    `Update here: ${magicLink}`,
    '',
    '---',
    COMPLIANCE,
  ].join('\n');
}

const GENERIC_CONTENT: Record<string, { heading: string; body: string }> = {
  'rsvp-reminder': {
    heading: 'Please RSVP by June 15th',
    body: 'This is a friendly reminder to RSVP for Yonatan & Saron\'s wedding by June 15th, 2026. We\'d love to know if you can make it!',
  },
  'logistics-update': {
    heading: 'Wedding Week Logistics',
    body: 'Here are the details you\'ll need for the big weekend. Visit our website for parking, hotel accommodations, and the full day-of schedule.',
  },
  'day-before-alert': {
    heading: 'We\'ll See You Tomorrow!',
    body: 'We are overjoyed — tomorrow is finally here, and we cannot wait to celebrate with you. One small note: we\'re anticipating some rain throughout the day, so just in case, we\'d recommend bringing a poncho for the ceremony. We\'ll keep you updated if anything changes. See you soon!',
  },
  'day-of-alert': {
    heading: 'Today is the Day!',
    body: 'We\'re so excited to celebrate with you today! Check our website for any last-minute updates.',
  },
  'thank-you': {
    heading: 'Thank You',
    body: 'Thank you so much for celebrating our wedding with us. Your presence, love, and support meant everything. We are so grateful to have you in our lives.',
  },
};

export async function POST(req: Request) {
  try {
    const { partyId, campaignId, channel } = await req.json();

    if (!partyId || !campaignId) {
      return NextResponse.json({ error: 'partyId and campaignId are required' }, { status: 400 });
    }

    // channel: 'email' | 'sms' | undefined (undefined = send both)
    const sendEmail = !channel || channel === 'email';
    const sendSms   = !channel || channel === 'sms';

    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialised — SUPABASE_SERVICE_ROLE_KEY missing');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // ── Fetch party + guests ──
    const { data: party, error: partyError } = await supabaseAdmin
      .from('parties')
      .select('id, party_name, emails, phones, has_responded, invite_token, guests(id, name, email, is_attending, has_responded)')
      .eq('id', partyId)
      .single();

    if (partyError || !party) {
      console.error('Party fetch error:', partyError);
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    const campaign = getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.disabled) {
      return NextResponse.json({ error: 'This campaign is currently locked' }, { status: 403 });
    }

    interface PartyGuestInfo {
      name?: string;
      is_attending?: boolean;
      has_responded?: boolean;
    }
    const acceptedGuestNames = (party.guests as PartyGuestInfo[])
      .filter(g => g.is_attending).map(g => g.name).filter(Boolean) as string[];
    // "Pending" here specifically means genuinely un-answered — not simply
    // is_attending === false, which is also true for guests who explicitly
    // declined. Nudging someone who already said no would be wrong.
    const pendingGuestNames = (party.guests as PartyGuestInfo[])
      .filter(g => !g.has_responded).map(g => g.name).filter(Boolean) as string[];

    if (campaignId === 'partial-rsvp-nudge' && pendingGuestNames.length === 0) {
      return NextResponse.json(
        { error: 'Every guest in this party already has a response — nobody to nudge.' },
        { status: 400 }
      );
    }

    // Identify all recipients
    interface Recipient {
      email: string;
      name: string;
    }
    interface GuestInfo {
      name?: string;
      email?: string;
    }
    const recipients: Recipient[] = [];

    // 1. Add guests with specific emails
    if (party.guests && Array.isArray(party.guests)) {
      (party.guests as GuestInfo[]).forEach((g) => {
        if (g.email && g.email.includes('@')) {
          recipients.push({ email: g.email, name: g.name || party.party_name });
        }
      });
    }

    // 2. Fallback to party-level emails if no guest-specific emails found
    if (recipients.length === 0 && party.emails && Array.isArray(party.emails)) {
      const fallbackName = (party.guests as GuestInfo[])?.[0]?.name || party.party_name || 'Friend';
      party.emails.forEach((e: string) => {
        if (e && e.includes('@')) {
          recipients.push({ email: e, name: fallbackName });
        }
      });
    }

    const subject = SUBJECTS[campaignId] || 'An update from Yonatan & Saron';
    const logEntries: { channel: string; status: string }[] = [];

    // ── Email ──
    if (sendEmail && recipients.length > 0 && campaign.priority !== 'sms') {
      let sentCount = 0;
      let failCount = 0;

      for (const recipient of recipients) {
        const guestName = recipient.name;
        let html = '';

        if (campaign.emailTemplate === 'FormalInvite') {
          html = await render(React.createElement(FormalInvite, { guestName, partyId }));
        } else if (campaign.emailTemplate === 'SaveTheDate') {
          html = await render(React.createElement(SaveTheDate, { guestName, partyId }));
        } else if (campaign.emailTemplate === 'SaveTheDate48hr') {
          html = await render(React.createElement(SaveTheDate, { guestName, partyId, urgent: true }));
        } else if (campaign.emailTemplate === 'PhotoSaveTheDate') {
          html = await render(React.createElement(PhotoSaveTheDate, { guestName, partyId }));
        } else if (campaign.emailTemplate === 'PartialRsvpNudge') {
          html = await render(React.createElement(PartialRsvpNudge, {
            partyId,
            acceptedNames: acceptedGuestNames,
            pendingNames: pendingGuestNames,
          }));
        } else if (campaign.emailTemplate === 'DeclinedRegistry') {
          html = await render(React.createElement(DeclinedRegistry, { guestName, partyId }));
        } else {
          const content = GENERIC_CONTENT[campaignId] || {
            heading: 'Update from Yonatan & Saron',
            body: 'Visit our website for the latest details.',
          };
          html = await render(
            React.createElement(GenericTemplate, {
              heading: content.heading,
              body: `Dear ${guestName}, ${content.body}`,
              partyId,
            })
          );
        }

        const { error: emailError } = await resend.emails.send({
          from: 'Yonatan & Saron (No Reply) <wedding@theestifanos.com>',
          to: recipient.email,
          subject,
          html,
        });

        if (emailError) {
          console.error(`Resend error for ${recipient.email}:`, emailError);
          failCount++;
        } else {
          sentCount++;
        }
      }

      const finalStatus = failCount === 0 ? 'sent' : sentCount > 0 ? 'partial' : 'failed';
      logEntries.push({ channel: 'email', status: finalStatus });

      await supabaseAdmin.from('campaign_logs').insert({
        party_id: partyId,
        campaign_id: campaignId,
        channel: 'email',
        status: finalStatus,
        sent_at: new Date().toISOString(),
      });

      if (finalStatus === 'failed') {
        return NextResponse.json({ error: 'Email send failed for all recipients' }, { status: 500 });
      }
    }

    // ── SMS ──
    if (sendSms && campaign.priority !== 'email') {
      const usPhones = (party.phones as string[] || []).filter(
        (p) => p && (p.startsWith('+1') || (p.replace(/\D/g, '').length === 11 && p.replace(/\D/g, '').startsWith('1')))
      );

      if (usPhones.length > 0 && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        let smsSentCount = 0;
        let smsFailCount = 0;

        // Use first guest name for personalization
        const guestName = (party.guests as { name?: string; is_attending?: boolean }[])?.[0]?.name || party.party_name || 'Friend';
        const inviteToken = (party as { invite_token?: string }).invite_token;

        // If they've already RSVPed, send a tailored acknowledgment instead of the campaign message
        // — except partial-rsvp-nudge (already-responded party with a newly added, still-pending
        // guest), declined-registry (deliberately targets already-declined parties), and
        // day-before-alert (a post-RSVP logistics update meant to reach confirmed guests
        // unchanged, not get swapped for the RSVP recap), which all need their own dedicated
        // copy instead of the generic recap.
        let smsBody: string;
        if (campaignId === 'partial-rsvp-nudge') {
          smsBody = buildPartialRsvpNudgeSmsBody(acceptedGuestNames, pendingGuestNames, partyId, inviteToken);
        } else if (campaignId === 'declined-registry' || campaignId === 'day-before-alert') {
          smsBody = buildSmsBody(campaignId, guestName, partyId, inviteToken);
        } else if (party.has_responded) {
          const allGuests = party.guests as { name?: string; is_attending?: boolean; has_responded?: boolean }[];
          const attending = allGuests.filter(g => g.is_attending).map(g => g.name || '').filter(Boolean);
          // Only list guests as "declined" if they've actually answered no —
          // a guest who's simply still pending shouldn't show up here.
          const declined  = allGuests.filter(g => g.has_responded && !g.is_attending).map(g => g.name || '').filter(Boolean);
          smsBody = buildAlreadyRsvpedSmsBody(guestName, partyId, attending, declined, inviteToken);
        } else {
          smsBody = buildSmsBody(campaignId, guestName, partyId, inviteToken);
        }

        const PRAY_IMAGE = 'https://foxezhxncpzzpbemdafa.supabase.co/storage/v1/object/public/wedding-ui/prayforus.JPG';
        const smsMediaUrl = campaignId === 'partial-rsvp-nudge' || campaignId === 'declined-registry' || campaignId === 'day-before-alert'
          ? (campaign.smsMediaUrl || null)
          : party.has_responded ? PRAY_IMAGE : (campaign.smsMediaUrl || null);

        for (const phone of usPhones) {
          try {
            await twilioClient.messages.create({
              to: phone,
              messagingServiceSid: 'MG0851f4936a77e5efd5c0f1d4b69eed14',
              body: smsBody,
              ...(smsMediaUrl ? { mediaUrl: [smsMediaUrl] } : {}),
            });
            smsSentCount++;
          } catch (smsErr) {
            console.error(`Twilio error for ${phone}:`, smsErr);
            smsFailCount++;
          }
        }

        const smsStatus = smsFailCount === 0 ? 'sent' : smsSentCount > 0 ? 'partial' : 'failed';
        logEntries.push({ channel: 'sms', status: smsStatus });

        await supabaseAdmin.from('campaign_logs').insert({
          party_id: partyId,
          campaign_id: campaignId,
          channel: 'sms',
          status: smsStatus,
          sent_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ success: true, results: logEntries });

  } catch (err) {
    console.error('Notify API unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
