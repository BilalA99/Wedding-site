import {
  Body,
  Head,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface CashGiftConfirmationProps {
  senderName: string;
}

export const CashGiftConfirmation = ({ senderName }: CashGiftConfirmationProps) => (
  <Html lang="en">
    <Head>
      <meta name="color-scheme" content="dark" />
      <meta name="supported-color-schemes" content="dark" />
    </Head>
    <Preview>Thank you for your gift — Yonatan & Saron</Preview>
    <Body style={body}>
      <Text style={label}>GIFT RECEIVED</Text>
      <Text style={title}>God bless you, {senderName}.</Text>

      <Text style={message}>
        We are so grateful for your generosity and love — thank you for
        helping us build our home together.
      </Text>

      <Text style={message}>
        If you have any questions or need to reach us personally, don&rsquo;t
        hesitate — we&rsquo;re just a text or call away.
      </Text>

      <Text style={footer}>
        With so much love &amp; gratitude,{'\n'}Yonatan &amp; Saron · September 4, 2026
      </Text>
    </Body>
  </Html>
);

export default CashGiftConfirmation;

const body: React.CSSProperties = {
  backgroundColor: '#0A0A0A',
  margin: '0 auto',
  padding: '60px 20px',
  maxWidth: '560px',
  fontFamily: 'Helvetica, Arial, sans-serif',
};

const label: React.CSSProperties = {
  color: '#A3A3A3',
  fontSize: '10px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  textAlign: 'center',
  margin: '0 0 16px',
};

const title: React.CSSProperties = {
  color: '#D4A845',
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '28px',
  textAlign: 'center',
  margin: '0 0 32px',
  fontWeight: 'normal',
};

const message: React.CSSProperties = {
  color: '#D4D4D4',
  fontFamily: 'Georgia, serif',
  fontSize: '15px',
  lineHeight: '1.8',
  textAlign: 'center',
  margin: '0 0 28px',
};

const footer: React.CSSProperties = {
  color: '#666666',
  fontSize: '12px',
  fontFamily: 'Georgia, serif',
  fontStyle: 'italic',
  textAlign: 'center',
  marginTop: '40px',
  lineHeight: '1.8',
  whiteSpace: 'pre-line',
};
