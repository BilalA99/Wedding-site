import {
  Body,
  Button,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface DeclinedRegistryProps {
  guestName?: string;
  partyId?: string;
}

const BASE_URL = 'https://theestifanos.com';
const PWD = 'Matthew19:6';
const PRAY_IMAGE_URL = 'https://foxezhxncpzzpbemdafa.supabase.co/storage/v1/object/public/wedding-ui/prayforus.JPG';

export const DeclinedRegistry = ({
  guestName = 'Friend',
  partyId,
}: DeclinedRegistryProps) => {
  // Routed through /i/<partyId> rather than ?partyId=<uuid> — a raw hex UUID
  // directly after "=" gets silently corrupted by outgoing quoted-printable
  // MIME encoding — see middleware.ts's /i/<partyId> handler.
  const magicLink = partyId
    ? `${BASE_URL}/i/${partyId}?view=final-invite`
    : `${BASE_URL}/?pwd=${PWD}&view=final-invite`;
  const registryLink = `${magicLink}#registry`;

  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      <Preview>We&apos;ll miss you — here&apos;s our story &amp; registry</Preview>

      <Body style={mainBody}>
        {/* ── Header ── */}
        <Text style={preHeader}>FROM YONATAN &amp; SARON</Text>

        <Hr style={hairline} />

        {/* ── Title ── */}
        <Text style={title}>We&apos;ll miss you!</Text>

        {/* ── Main Message ── */}
        <Text style={messageText}>
          {guestName}, we were recently notified you won&apos;t be able to join us
          on September 4, 2026. We completely understand — thank you for letting
          us know, and we&apos;ll be thinking of you.
        </Text>

        <Text style={messageText}>
          Even from afar, we&apos;d love for you to feel close to our story.
        </Text>

        {/* ── CTA ── */}
        <Section style={ctaSection}>
          <Button style={ctaButton} href={magicLink}>
            SEE OUR STORY
          </Button>
        </Section>

        {/* ── Registry ── */}
        <Text style={escapeHatchText}>
          You asked about our registry — here it is, with our love and thanks.
        </Text>
        <Section style={ctaSection}>
          <Button style={ctaButtonSecondary} href={registryLink}>
            VIEW REGISTRY
          </Button>
        </Section>

        {/* ── Hero Image ── */}
        <Img
          src={PRAY_IMAGE_URL}
          alt="Praying over Yonatan and Saron"
          width="440"
          style={heroImage}
        />
        <Text style={caption}>
          Pastor Ashenafi praying over our upcoming marriage at our engagement celebration.
        </Text>

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

export default DeclinedRegistry;

// ── Styles ────────────────────────────────────────────────────────────────────

const mainBody: React.CSSProperties = {
  backgroundColor: '#0A0A0A',
  margin: '0 auto',
  padding: '60px 20px',
  textAlign: 'center',
  fontFamily: "Georgia, 'Times New Roman', serif",
  maxWidth: '600px',
};

const preHeader: React.CSSProperties = {
  color: '#D4A845',
  fontSize: '10px',
  letterSpacing: '6px',
  textTransform: 'uppercase',
  margin: '0 0 10px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const hairline: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #332911',
  margin: '30px auto',
  width: '40px',
};

const title: React.CSSProperties = {
  color: '#F9FAFB',
  fontSize: '32px',
  lineHeight: '1.2',
  margin: '0 0 40px',
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontWeight: '400',
};

const messageText: React.CSSProperties = {
  color: '#D1D5DB',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 auto 24px',
  maxWidth: '440px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const escapeHatchText: React.CSSProperties = {
  color: '#9C8C78',
  fontSize: '13px',
  lineHeight: '1.6',
  fontStyle: 'italic',
  margin: '32px auto 20px',
  maxWidth: '400px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const ctaSection: React.CSSProperties = {
  margin: '0 0 20px',
};

const ctaButton: React.CSSProperties = {
  border: '1px solid #D4A845',
  color: '#D4A845',
  padding: '14px 40px',
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  fontSize: '10px',
  textDecoration: 'none',
  display: 'inline-block',
  borderRadius: '100px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const ctaButtonSecondary: React.CSSProperties = {
  ...ctaButton,
  border: '1px solid #4B4030',
  color: '#D1D5DB',
  marginBottom: '40px',
};

const heroImage: React.CSSProperties = {
  width: '100%',
  maxWidth: '440px',
  height: 'auto',
  display: 'block',
  margin: '0 auto 12px',
  borderRadius: '8px',
};

const caption: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontStyle: 'italic',
  fontSize: '12px',
  color: '#888888',
  textAlign: 'center',
  margin: '0 auto 40px',
  maxWidth: '400px',
};

const monogram: React.CSSProperties = {
  color: '#D4A845',
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontStyle: 'italic',
  fontSize: '24px',
  marginTop: '60px',
  marginBottom: '20px',
};

const footer: React.CSSProperties = {
  color: '#3D3D3D',
  fontSize: '10px',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  margin: '0',
  fontFamily: "Georgia, 'Times New Roman', serif",
};
