import {
  Body,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Link,
} from '@react-email/components';
import * as React from 'react';

interface VendorDayBeforeProps {
  vendorName?: string;
}

const SITE_LINK = 'https://theestifanos.com/?pwd=Matthew19:6&view=final-invite';

export const VendorDayBefore = ({
  vendorName = 'Friend',
}: VendorDayBeforeProps) => {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      <Preview>See you tomorrow — Yonatan &amp; Saron · September 4, 2026</Preview>

      <Body style={mainBody}>
        {/* ── Pre-header ── */}
        <Text style={preHeader}>SEE YOU TOMORROW</Text>

        {/* ── Framing ── */}
        <Hr style={hairline} />

        {/* ── Stacked Names ── */}
        <Text style={names}>
          Yonatan
          <br />
          <span style={ampersand}>&amp;</span>
          <br />
          Saron
        </Text>

        {/* ── Date Line ── */}
        <Text style={dateLine}>SEPTEMBER 4, 2026</Text>

        {/* ── Framing ── */}
        <Hr style={hairline} />

        {/* ── Salutation ── */}
        <Text style={salutation}>Hi {vendorName},</Text>

        {/* ── Main Message ── */}
        <Text style={message}>
          We are so excited — tomorrow is finally here! Thank you again for
          being part of making our day so special.
        </Text>
        <Text style={message}>
          One quick note: we&apos;re expecting a bit of rain throughout the
          day, so please plan accordingly. We&apos;ll keep you posted if
          anything changes.
        </Text>

        {/* ── CTA ── */}
        <Section style={ctaSection}>
          <Link href={SITE_LINK} style={ctaButton}>
            VISIT OUR WEBSITE
          </Link>
        </Section>

        {/* ── Contacts ── */}
        <Section style={contactSection}>
          <Text style={contactLabel}>Questions or day-of issues?</Text>
          <Text style={contactLine}>Yonatan — 717-963-5535</Text>
          <Text style={contactLine}>Saron — 240-694-5559</Text>
        </Section>
        <Section style={contactSection}>
          <Text style={contactLabel}>Day-of point of contact</Text>
          <Text style={contactLine}>Elsa Guta — 510-328-0055</Text>
          <Text style={contactLine}>Elisabethsenbeta@gmail.com</Text>
        </Section>

        {/* ── Monogram ── */}
        <Text style={monogram}>Y &amp; S</Text>

        {/* ── Footer ── */}
        <Text style={footer}>
          Yonatan &amp; Saron · September 4, 2026
          <br />
          (Please do not reply to this email)
        </Text>
      </Body>
    </Html>
  );
};

export default VendorDayBefore;

// ── Styles ────────────────────────────────────────────────────────────────────

const mainBody: React.CSSProperties = {
  backgroundColor: '#FCFBF8',
  margin: '0 auto',
  padding: '60px 20px',
  textAlign: 'center',
  fontFamily: "Georgia, 'Times New Roman', serif",
  maxWidth: '600px',
};

const preHeader: React.CSSProperties = {
  color: '#B08D57',
  fontSize: '10px',
  letterSpacing: '6px',
  textTransform: 'uppercase',
  margin: '0 0 10px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const hairline: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #D6D4D1',
  margin: '30px auto',
  width: '48px',
};

const names: React.CSSProperties = {
  color: '#423E37',
  fontSize: '48px',
  lineHeight: '1.1',
  margin: '0 0 20px',
  fontFamily: "'Playfair Display', Didot, Georgia, serif",
  fontWeight: '400',
  fontStyle: 'normal',
};

const ampersand: React.CSSProperties = {
  color: '#B08D57',
  fontSize: '0.7em',
  fontStyle: 'italic',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const dateLine: React.CSSProperties = {
  color: '#B08D57',
  fontSize: '11px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  margin: '0 0 10px',
  whiteSpace: 'nowrap',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const salutation: React.CSSProperties = {
  color: '#423E37',
  fontSize: '16px',
  margin: '0 0 16px',
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontStyle: 'italic',
};

const message: React.CSSProperties = {
  color: '#5A544C',
  fontSize: '14px',
  lineHeight: '1.8',
  margin: '0 auto 20px',
  textAlign: 'center',
  maxWidth: '440px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const ctaSection: React.CSSProperties = {
  margin: '20px 0 30px',
};

const contactSection: React.CSSProperties = {
  margin: '0 0 24px',
};

const contactLabel: React.CSSProperties = {
  color: '#B08D57',
  fontSize: '10px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  margin: '0 0 6px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const contactLine: React.CSSProperties = {
  color: '#5A544C',
  fontSize: '13px',
  margin: '0 0 2px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const ctaButton: React.CSSProperties = {
  border: '1px solid #B08D57',
  color: '#B08D57',
  padding: '14px 40px',
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  fontSize: '10px',
  textDecoration: 'none',
  display: 'inline-block',
  borderRadius: '100px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const monogram: React.CSSProperties = {
  color: '#B08D57',
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontStyle: 'italic',
  fontSize: '24px',
  marginTop: '0',
  marginBottom: '20px',
};

const footer: React.CSSProperties = {
  color: '#A1A1AA',
  fontSize: '10px',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  margin: '0',
  fontFamily: "Georgia, 'Times New Roman', serif",
};
