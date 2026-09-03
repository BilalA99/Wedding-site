export type CampaignId =
  | 'save-the-date'
  | 'save-the-date-48hr'
  | 'formal-invitation'
  | 'partial-rsvp-nudge'
  | 'declined-registry'
  | 'rsvp-reminder'
  | 'logistics-update'
  | 'day-before-alert'
  | 'day-of-alert'
  | 'thank-you';

export interface Campaign {
  id: CampaignId;
  label: string;
  smsBody: string;
  smsMediaUrl?: string;
  emailTemplate: string;
  priority: 'email' | 'sms' | 'both';
  disabled?: boolean;
}

const COMPLIANCE_FOOTER = 'You are subscribed to receive wedding updates. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.';
const SITE_LINK = 'https://theestifanos.com/?pwd=Matthew19:6';
const PHOTO_STD = 'https://foxezhxncpzzpbemdafa.supabase.co/storage/v1/object/public/wedding-ui/engagement_photo_3.jpeg';
// Formal Invitation SMS MMS image only — the paired email keeps its own
// hardcoded hero photo (eng-main-image-email-hero.jpg in FormalInvite.tsx),
// unchanged.
const PHOTO_INVITE = 'https://foxezhxncpzzpbemdafa.supabase.co/storage/v1/object/public/wedding-ui/enjoyingeachother.jpg';

export const CAMPAIGNS: Campaign[] = [
  {
    id: 'save-the-date',
    label: 'Save the Date',
    smsBody: `Save the Date! Yonatan & Saron are getting married on September 4, 2026 in Wrightsville, PA. RSVP at ${SITE_LINK}\n\n${COMPLIANCE_FOOTER}`,
    smsMediaUrl: PHOTO_STD,
    emailTemplate: 'SaveTheDate',
    priority: 'both',
  },
  {
    id: 'save-the-date-48hr',
    label: '48hr Save the Date',
    smsBody: `Save the Date! Yonatan & Saron are getting married on September 4, 2026 in Wrightsville, PA. Can you confirm in the next 48 hours? RSVP at ${SITE_LINK}\n\n${COMPLIANCE_FOOTER}`,
    smsMediaUrl: PHOTO_STD,
    emailTemplate: 'SaveTheDate48hr',
    priority: 'both',
  },
  {
    id: 'formal-invitation',
    label: 'Formal Invitation',
    smsBody: `You are formally invited to the wedding of Yonatan & Saron — September 4, 2026, Wrightsville, PA. RSVP at ${SITE_LINK}\n\n${COMPLIANCE_FOOTER}`,
    smsMediaUrl: PHOTO_INVITE,
    emailTemplate: 'FormalInvite',
    priority: 'both',
    disabled: false,
  },
  {
    // Sent to a party where some guests have already RSVPed but a newly
    // added guest hasn't — content is built dynamically per-party in
    // notify/route.ts (accepted vs. pending names), so this smsBody is
    // just a representative placeholder, unused at send time.
    id: 'partial-rsvp-nudge',
    label: 'Partial RSVP Nudge (48hr)',
    smsBody: `RSVP UPDATE: Some of your party is confirmed for Yonatan & Saron's wedding on September 4, 2026, but we haven't heard from everyone yet. Can you confirm within 48 hours? ${SITE_LINK}\n\n${COMPLIANCE_FOOTER}`,
    emailTemplate: 'PartialRsvpNudge',
    priority: 'both',
    disabled: false,
  },
  {
    // Sent to parties who declined but asked for registry info — content is
    // built dynamically per-party in notify/route.ts, so this smsBody is
    // just a representative placeholder, unused at send time.
    id: 'declined-registry',
    label: "Registry Info (Can't Make It)",
    smsBody: `We were recently notified you won't be able to make it to Yonatan & Saron's wedding on September 4, 2026. We'd still love for you to be part of our story: ${SITE_LINK}&view=final-invite\n\nRegistry: ${SITE_LINK}&view=final-invite#registry\n\n${COMPLIANCE_FOOTER}`,
    emailTemplate: 'DeclinedRegistry',
    priority: 'both',
    disabled: false,
  },
  {
    id: 'rsvp-reminder',
    label: 'RSVP Deadline Reminder',
    smsBody: `Reminder: Please RSVP for Yonatan & Saron's wedding by June 15th at ${SITE_LINK}\n\n${COMPLIANCE_FOOTER}`,
    smsMediaUrl: PHOTO_STD,
    emailTemplate: 'GenericTemplate',
    priority: 'both',
    disabled: true,
  },
  {
    id: 'logistics-update',
    label: 'Wedding Week Logistics',
    smsBody: `Wedding week details for Yonatan & Saron's wedding are now available! See parking, hotel & schedule at ${SITE_LINK}\n\n${COMPLIANCE_FOOTER}`,
    smsMediaUrl: PHOTO_STD,
    emailTemplate: 'GenericTemplate',
    priority: 'both',
    disabled: true,
  },
  {
    id: 'day-before-alert',
    label: 'Day-Before Alert (Weather)',
    smsBody: `The day before! We are SO excited to celebrate with you tomorrow. Heads up: we're expecting a bit of rain throughout the day — just in case, bring a poncho for the ceremony. We'll keep you posted if anything changes. See ${SITE_LINK}\n\n${COMPLIANCE_FOOTER}`,
    emailTemplate: 'GenericTemplate',
    priority: 'both',
    disabled: false,
  },
  {
    id: 'day-of-alert',
    label: 'Day-of Updates',
    smsBody: `Wedding day update from Yonatan & Saron! Check ${SITE_LINK} for last-minute details.\n\n${COMPLIANCE_FOOTER}`,
    emailTemplate: 'GenericTemplate',
    priority: 'sms',
    disabled: true,
  },
  {
    id: 'thank-you',
    label: 'Thank You',
    smsBody: `Thank you for celebrating with us! — Yonatan & Saron. Visit ${SITE_LINK}\n\n${COMPLIANCE_FOOTER}`,
    smsMediaUrl: PHOTO_STD,
    emailTemplate: 'GenericTemplate',
    priority: 'email',
    disabled: true,
  },
];

export const getCampaign = (id: string): Campaign | undefined => {
  return CAMPAIGNS.find((c) => c.id === id);
};
