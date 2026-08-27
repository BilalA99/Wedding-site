import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';
import RSVPConfirmation from '@/emails/RSVPConfirmation';
import RSVPDeclined from '@/emails/RSVPDeclined';
import twilio from 'twilio';

/** Normalize a US phone number to E.164 (+1XXXXXXXXXX). Returns null if not a US number. */
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export async function POST(req: Request) {
  try {
    const { party_id, email, phone, message, guests } = await req.json();

    if (!party_id) {
      return NextResponse.json({ error: 'Party ID is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      console.error('Supabase Admin client not initialized');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

    // Fetch current contact arrays so we can merge without duplicates
    const { data: currentParty } = await supabaseAdmin
      .from('parties')
      .select('emails, phones, party_name, invite_token')
      .eq('id', party_id)
      .single();

    const existingEmails: string[] = currentParty?.emails || [];
    const existingPhones: string[] = currentParty?.phones || [];
    const normalizedPhone = phone ? toE164(phone) : null;
    const mergedEmails = email && !existingEmails.includes(email)
      ? [...existingEmails, email]
      : existingEmails;
    const mergedPhones = normalizedPhone && !existingPhones.includes(normalizedPhone)
      ? [...existingPhones, normalizedPhone]
      : existingPhones;

    // Update party info. We allow multiple submissions now to support updates (e.g. from Decline to Accept).
    const { data: updatedParty, error: partyError } = await supabaseAdmin
      .from('parties')
      .update({
        emails: mergedEmails,
        phones: mergedPhones,
        status: 'replied',
        has_responded: true,
        admin_notes: message ? `User Message: ${message}` : undefined
      })
      .eq('id', party_id)
      .select('id, party_name, emails, guests(email)')
      .maybeSingle();

    if (partyError) {
      console.error('Error updating party:', partyError);
      return NextResponse.json({ error: 'Failed to update RSVP' }, { status: 500 });
    }

    // If no rows updated, party not found
    if (!updatedParty) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    // 2. Update Guests (all in a single transaction via RPC)
    if (guests && Array.isArray(guests) && guests.length > 0) {
      // Validate that all guest IDs belong to this party
      const guestIds = guests.map((g: { id: string }) => g.id);
      const { data: validGuests, error: validationError } = await supabaseAdmin
        .from('guests')
        .select('id')
        .eq('party_id', party_id)
        .in('id', guestIds);

      if (validationError) {
        console.error('Error validating guests:', validationError);
        return NextResponse.json({ error: 'Failed to validate guests' }, { status: 500 });
      }

      // Check that all submitted guest IDs were found for this party
      if (!validGuests || validGuests.length !== guestIds.length) {
        console.error('Guest ID mismatch: some guests do not belong to this party');
        return NextResponse.json({ error: 'Invalid guest data' }, { status: 400 });
      }

      const { error: guestError } = await supabaseAdmin.rpc('update_guests_for_party', {
        p_party_id: party_id,
        p_guests: guests.map((g: { id: string; is_attending: boolean; name: string; dietary_notes?: string; phone?: string }) => ({
          id: g.id,
          is_attending: g.is_attending,
          name: g.name,
          dietary_notes: g.dietary_notes,
          phone: g.phone?.trim() || null
        }))
      });

      if (guestError) {
        console.error('Error updating guests:', guestError);
        throw guestError;
      }
    }

    // 3. Send Internal Alert and Guest Confirmation
    if (resend) {
      interface GuestResponse {
        name: string;
        is_attending: boolean;
        dietary_notes?: string;
      }
      const attending = (guests as GuestResponse[]).filter(g => g.is_attending).map(g => g.name);
      const declined = (guests as GuestResponse[]).filter(g => !g.is_attending).map(g => g.name);
      const dietary = (guests as GuestResponse[]).filter(g => g.dietary_notes).map(g => `${g.name}: ${g.dietary_notes}`);

      // Internal Alert
      await resend.emails.send({
        from: 'RSVP Alert <notifications@theestifanos.com>',
        to: 'theestifanos@gmail.com',
        subject: `New RSVP: The ${updatedParty.party_name} Family`,
        html: `
          <h1>New RSVP Submission</h1>
          <p><strong>Party:</strong> ${updatedParty.party_name}</p>
          <p><strong>Attending:</strong> ${attending.length > 0 ? attending.join(', ') : 'None'}</p>
          <p><strong>Declined:</strong> ${declined.length > 0 ? declined.join(', ') : 'None'}</p>
          ${dietary.length > 0 ? `<p><strong>Dietary Restrictions:</strong><br/>${dietary.join('<br/>')}</p>` : ''}
          ${message ? `<p><strong>Message for Couple:</strong><br/>"${message}"</p>` : ''}
          <p><a href="https://theestifanos.com/admin">View in Dashboard</a></p>
        `
      }).catch(err => console.error('Internal Alert Error:', err));

      // Guest Confirmation (send to all unique emails in party and guests)
      const allEmails = new Set<string>();
      if (updatedParty.emails) updatedParty.emails.forEach(e => e && e.includes('@') && allEmails.add(e.toLowerCase()));
      
      interface GuestWithEmail {
        email?: string;
      }
      if (updatedParty.guests) (updatedParty.guests as GuestWithEmail[]).forEach(g => g.email && g.email.includes('@') && allEmails.add(g.email.toLowerCase()));

      const isAttending = (guests as GuestResponse[]).some(g => g.is_attending);

      for (const guestEmail of Array.from(allEmails)) {
        await resend.emails.send({
          from: 'Yonatan & Saron (No Reply) <hello@theestifanos.com>',
          to: guestEmail,
          subject: isAttending ? 'RSVP Confirmed — Yonatan & Saron' : 'RSVP Declined — Yonatan & Saron',
          react: isAttending
            ? RSVPConfirmation({ guests, partyId: party_id, inviteToken: currentParty?.invite_token })
            : RSVPDeclined({ partyId: party_id, inviteToken: currentParty?.invite_token })
        }).catch(err => console.error(`Guest Confirmation Error (${guestEmail}):`, err));
      }
    }

    // 4. Send SMS Confirmation
    if (normalizedPhone) {
      try {
        const twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );

        const COMPLIANCE = 'You are subscribed to receive wedding updates. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.';
        const inviteToken = currentParty?.invite_token;
        const magicLink = inviteToken
          ? `https://theestifanos.com/?token=${inviteToken}`
          : `https://theestifanos.com/?pwd=Matthew19:6&partyId=${party_id}`;

        interface GuestResponse { name: string; is_attending: boolean; }
        const attending = (guests as GuestResponse[]).filter(g => g.is_attending).map(g => g.name);
        const isAttending = attending.length > 0;

        const smsBody = isAttending
          ? [
              'RSVP CONFIRMED',
              '',
              "We can't wait to celebrate with you.",
              '',
              'Thank you for confirming your attendance. We are currently preparing your formal invitation suite, which will include the venue location, day-of details, and our full weekend itinerary. We will reach out to your party soon with these final details.',
              '',
              'ATTENDING:',
              ...attending,
              '',
              'THE PRAYER REQUEST',
              "More than anything, as we prepare to enter into this marriage covenant, our greatest request is your continued prayers. Please join us in praying over our relationship, our future together, and the beautiful day ahead.",
              '',
              'Yonatan & Saron · September 4, 2026',
              '',
              '---',
              COMPLIANCE,
            ].join('\n')
          : [
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

        await twilioClient.messages.create({
          to: normalizedPhone,
          messagingServiceSid: 'MG0851f4936a77e5efd5c0f1d4b69eed14',
          body: smsBody,
          mediaUrl: ['https://foxezhxncpzzpbemdafa.supabase.co/storage/v1/object/public/wedding-ui/prayforus.JPG'],
        });
      } catch (smsErr) {
        console.error('Twilio SMS confirmation error (non-critical):', smsErr);
      }
    }

    // 5. Create Audit Log
    const { error: auditError } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        party_id,
        action: 'RSVP_SUBMITTED',
        details: {
          email,
          phone,
          message,
          guests_updated: guests?.length || 0
        }
      });

    if (auditError) {
      console.warn('Failed to create audit log (non-critical):', auditError);
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('Submit API unhandled error:', err);
    return NextResponse.json({ error: 'Failed to submit RSVP' }, { status: 500 });
  }
}
