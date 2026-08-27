'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useNavView } from '@/context/ViewContext';
import { useOpacitySettle } from '@/hooks/useOpacitySettle';

// ============================================================================
// COOKIE HELPERS
// ============================================================================
const VIP_COOKIE = 'vip_party_id';

function getVipPartyId(): string | null {
  if (typeof document === 'undefined') return null;
  return (
    document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${VIP_COOKIE}=`))
      ?.split('=')[1]
      ?.split(';')[0] ?? null
  );
}

function setVipPartyId(partyId: string) {
  const expires = new Date();
  expires.setDate(expires.getDate() + 90);
  document.cookie = `${VIP_COOKIE}=${encodeURIComponent(partyId)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function clearVipPartyId() {
  document.cookie = `${VIP_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// ============================================================================
// TYPES
// ============================================================================
interface Guest {
  id: string;
  name: string;
  is_attending: boolean;
  is_plus_one: boolean;
}

interface Party {
  id: string;
  party_name: string;
  status: string;
  has_responded: boolean;
  guests: Guest[];
}

// ============================================================================
// LUXURY INPUT — bottom-border only
// ============================================================================
function LuxuryInput({
  label,
  id,
  className,
  ...props
}: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { language } = useLanguage();
  const isAmharic = language === 'am';

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={`text-xs tracking-widest uppercase font-medium text-wedding-gold/80 text-center ${isAmharic ? 'font-ethiopic' : 'font-sans'}`}
      >
        {label}
      </label>
      <input
        id={id}
        className={`w-full bg-transparent border-b border-hairline py-3 text-lg tracking-wide outline-none text-stone-200 placeholder:text-stone-600 placeholder:italic focus:border-ink/50 transition-colors duration-300 text-center ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'} ${className ? ` ${className}` : ''}`}
        {...props}
      />
    </div>
  );
}

function LuxuryTextarea({
  label,
  id,
  ...props
}: { label: string; id: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { language } = useLanguage();
  const isAmharic = language === 'am';

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={`text-xs tracking-widest uppercase font-medium text-wedding-gold/80 ${isAmharic ? 'font-ethiopic' : 'font-sans'}`}
      >
        {label}
      </label>
      <textarea
        id={id}
        className={`w-full bg-transparent border-b border-hairline py-3 text-lg tracking-wide outline-none text-stone-200 resize-none placeholder:text-stone-600 placeholder:italic focus:border-ink/50 transition-colors duration-300 ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}
        {...props}
      />
    </div>
  );
}

// ============================================================================
// BUTTON
// ============================================================================
const btnClass =
  'border border-accent text-accent bg-transparent hover:bg-accent/10 px-10 py-3 rounded-full text-[10px] tracking-widest uppercase font-sans transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed';

// ============================================================================
// SEARCH SCREEN
// ============================================================================
function SearchScreen({
  onFound,
  onMultiple,
}: {
  onFound: (party: Party) => void;
  onMultiple: (parties: Party[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t, language } = useLanguage();
  const isAmharic = language === 'am';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedQuery = query.trim();
    const lowercaseQuery = trimmedQuery.toLowerCase();

    // Magic Search for Carrier Verification
    if (lowercaseQuery === 'carrier test' || lowercaseQuery === 'twilio test') {
      onFound({
        id: 'mock-id-verification',
        party_name: 'Carrier Verification',
        status: 'pending',
        has_responded: false,
        guests: [
          { id: 'mock-1', name: 'Reviewer One', is_attending: false, is_plus_one: false },
          { id: 'mock-2', name: 'Reviewer Two', is_attending: false, is_plus_one: false }
        ]
      });
      return;
    }

    if (!trimmedQuery) {
      setError(t('rsvp.errorRequired'));
      return;
    }

    if (trimmedQuery.length < 2) {
      setError(t('rsvp.errorMinLength'));
      return;
    }

    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/rsvp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedQuery }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      const matches: Party[] = (data.parties || []).map((p: Party) => ({
        ...p,
        guests: Array.isArray(p.guests) ? p.guests : [],
        has_responded: typeof p.has_responded === 'boolean' ? p.has_responded : false,
      }));

      if (matches.length === 0) {
        throw new Error(t('rsvp.notFound'));
      }

      if (matches.length === 1) {
        onFound(matches[0]);
      } else {
        onMultiple(matches);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      console.error(err);
      let msg = t('rsvp.notFound');
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          msg = t('rsvp.timeout');
        } else {
          msg = err.message;
        }
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto text-center">
      <p className={`text-base md:text-lg mb-10 leading-relaxed px-4 text-stone-400 text-center mx-auto ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
        {t('rsvp.searchPrompt')}
      </p>

      <form onSubmit={handleSearch} className="flex flex-col gap-6">
        <div className="text-center">
          <LuxuryInput
            label={t('rsvp.namePlaceholder')}
            id="search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            placeholder={t('rsvp.nameExample')}
            className="text-center"
          />
        </div>

        {error && (
          <p className="text-sm font-serif italic text-center text-red-500">
            {error}
          </p>
        )}

        <button type="submit" disabled={isLoading} className={btnClass}>
          {isLoading ? t('rsvp.searching') : t('rsvp.findButton')}
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// SELECT SCREEN — disambiguation when multiple parties match the same name
// ============================================================================
function SelectScreen({
  parties,
  onSelect,
  onBack,
}: {
  parties: Party[];
  onSelect: (party: Party) => void;
  onBack: () => void;
}) {
  const { t, language } = useLanguage();
  const isAmharic = language === 'am';

  return (
    <div className="w-full max-w-lg">
      <div className="w-full flex justify-start">
        <button
          onClick={onBack}
          className={`mb-8 text-sm tracking-wide flex items-center gap-2 text-stone-500 hover:text-stone-300 transition-colors ${isAmharic ? 'font-ethiopic' : 'font-serif'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('rsvp.searchAgain')}
        </button>
      </div>

      <p className={`text-base md:text-lg mb-8 leading-relaxed text-stone-400 text-center ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
        {t('rsvp.multipleFound')}
      </p>

      <div className="flex flex-col gap-4">
        {parties.map((party) => {
          const guestNames = party.guests
            .filter(g => g.name?.trim())
            .map(g => g.name.trim())
            .join(', ');
          return (
            <button
              key={party.id}
              onClick={() => onSelect(party)}
              className="text-left w-full px-6 py-6 border border-hairline hover:border-accent/40 bg-ink/5 rounded-xl transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xl text-stone-200 group-hover:text-accent transition-colors ${isAmharic ? 'font-ethiopic' : 'font-serif'}`}>
                  {party.party_name}
                </p>
                <span className={`text-[10px] tracking-widest text-accent font-sans uppercase opacity-0 group-hover:opacity-100 transition-opacity ${isAmharic ? 'font-ethiopic normal-case tracking-normal' : ''}`}>
                  {t('rsvp.thisIsMe')} &rarr;
                </span>
              </div>
              {guestNames && (
                <p className={`text-sm text-stone-500 leading-relaxed ${isAmharic ? 'font-ethiopic font-light' : 'font-serif italic'}`}>
                  {t('rsvp.includes')} {guestNames}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// RSVP FORM SCREEN
// ============================================================================
function FormScreen({
  party,
  onSubmit,
  onBack,
  onNotMyFamily,
}: {
  party: Party;
  onSubmit: () => void;
  onBack: () => void;
  onNotMyFamily?: () => void;
}) {
  const [guests, setGuests] = useState<Guest[]>(
    party.guests.map((g) => ({ ...g }))
  );
  // Guests whose Accept/Decline choice the visitor has actually clicked this
  // session. A guest's `is_attending` defaults to false in the DB before
  // anyone responds, which used to make "Decline" render pre-selected for
  // every guest on first load — easy to miss and submit by accident. If the
  // party has already responded before (this is an edit), their real prior
  // answers are legitimate and shown pre-selected; otherwise every guest
  // starts untouched so neither button is highlighted until explicitly chosen.
  const [touchedGuests, setTouchedGuests] = useState<Set<number>>(
    () => new Set(party.has_responded ? party.guests.map((_, i) => i) : [])
  );
  const [contact, setContact] = useState({ email: '', phone: '', message: '' });
  const [smsConsent, setSmsConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { t, language } = useLanguage();
  const isAmharic = language === 'am';

  // Ref to prevent double-submission (synchronous check before React state updates)
  const isSubmittingRef = useRef(false);

  // Watchdog against the scroll-reveal opacity occasionally getting stuck
  // mid-fade under heavy fast-scroll main-thread work — see useOpacitySettle.
  const revealRef = useRef<HTMLDivElement>(null);
  const revealInView = useInView(revealRef, { once: true, margin: '-80px' });
  useOpacitySettle(revealRef, revealInView, 1500);

  const toggleGuest = (index: number, attending: boolean) => {
    setGuests((prev) =>
      prev.map((g, i) => (i === index ? { ...g, is_attending: attending } : g))
    );
    setTouchedGuests((prev) => new Set(prev).add(index));
  };

  const handleNameChange = (index: number, newName: string) => {
    setGuests((prev) =>
      prev.map((g, i) => (i === index ? { ...g, name: newName } : g))
    );
  };

  const validateForm = (): string | null => {
    // Check for empty guest list
    if (!guests || guests.length === 0) {
      return t('rsvp.noGuests');
    }

    // Every guest must have an explicit Accept/Decline choice — prevents
    // accidentally submitting the untouched default (Decline) for someone
    // the visitor never actually meant to answer for.
    if (guests.some((_, i) => !touchedGuests.has(i))) {
      return t('rsvp.errorMissingResponse');
    }

    // Email validation - stricter regex
    // Requires: 2+ chars before @, 2+ chars domain, 2+ chars TLD
    const email = contact.email.trim().toLowerCase();
    const emailRegex = /^[a-z0-9._%+-]{2,}@[a-z0-9.-]{2,}\.[a-z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      return t('rsvp.errorEmail');
    }

    // Phone validation (10-15 digits for domestic/international)
    const phoneDigits = contact.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return t('rsvp.errorPhone');
    }

    // SMS Consent validation
    if (!smsConsent) {
      return t('rsvp.errorConsent');
    }

    // Plus-one name validation: if attending, name is required
    for (const guest of guests) {
      if (guest.is_plus_one && guest.is_attending && !guest.name?.trim()) {
        return t('rsvp.errorGuestName');
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Synchronous check to prevent double-submission
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;

    setSubmitError('');

    // Validate form before submitting
    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      isSubmittingRef.current = false;
      return;
    }

    setIsSubmitting(true);

    // Create abort controller with 20 second timeout (longer for submission)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch('/api/rsvp/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          party_id: party.id,
          email: contact.email,
          phone: contact.phone,
          message: contact.message,
          guests
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      onSubmit();
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      console.error('RSVP Submit Error:', err);
      let msg = t('rsvp.submitError');
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          msg = t('rsvp.timeout');
        } else {
          msg = err.message;
        }
      }
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="w-full max-w-xl">
      {/* Back Button */}
      <button
        onClick={onBack}
        className={`mb-8 text-sm tracking-wide flex items-center gap-2 text-stone-500 hover:text-stone-300 transition-colors ${isAmharic ? 'font-ethiopic' : 'font-serif'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('rsvp.searchAgain')}
      </button>

      {/* Welcome Header */}
      <div className="text-center mb-10">
        <p className={`text-xs tracking-widest uppercase mb-2 text-wedding-gold/80 ${isAmharic ? 'font-ethiopic' : 'font-sans'}`}>
          {t('rsvp.youreInvited')}
        </p>
        <h3 className={`text-3xl md:text-4xl tracking-wide text-stone-200 ${isAmharic ? 'font-ethiopic font-light' : 'font-display'}`}>
          {t('rsvp.welcome').replace('{name}', party.party_name)}
        </h3>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Guest List */}
        <div className="mb-10">
          <p className={`text-xs tracking-widest uppercase font-medium text-wedding-gold/80 mb-6 ${isAmharic ? 'font-ethiopic' : 'font-sans'}`}>
            {t('rsvp.respondForEach')}
          </p>

          {/* Empty guests message */}
          {guests.length === 0 && (
            <div className="text-center py-8 border border-hairline rounded-lg">
              <p className={`text-stone-400 italic ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
                {t('rsvp.noGuests')}
              </p>
              <p className={`text-stone-500 text-sm mt-2 ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
                {t('rsvp.contactCouple')}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {guests.map((guest, idx) => (
              <div
                key={guest.id}
                className="flex flex-col gap-3 py-4 border-b border-hairline"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-lg tracking-wide text-stone-200 ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
                    {guest.is_plus_one && !guest.name ? `Guest ${idx + 1}` : guest.name}
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleGuest(idx, true)}
                      className={`px-4 py-2 text-[10px] tracking-widest uppercase border rounded-full transition-all duration-300 ${isAmharic ? 'font-ethiopic normal-case tracking-normal' : 'font-sans'} ${
                        touchedGuests.has(idx) && guest.is_attending
                          ? 'border-green-500 text-green-500 bg-green-500/10'
                          : 'bg-transparent border-hairline text-ink/60 hover:border-green-500/50 hover:text-green-500'
                      }`}
                    >
                      {t('rsvp.accept')}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleGuest(idx, false)}
                      className={`px-4 py-2 text-[10px] tracking-widest uppercase border rounded-full transition-all duration-300 ${isAmharic ? 'font-ethiopic normal-case tracking-normal' : 'font-sans'} ${
                        touchedGuests.has(idx) && !guest.is_attending
                          ? 'border-red-500 text-red-500 bg-red-500/10'
                          : 'bg-transparent border-hairline text-ink/60 hover:border-red-500/50 hover:text-red-500'
                      }`}
                    >
                      {t('rsvp.decline')}
                    </button>
                  </div>
                </div>

                {/* Edit Plus One Name */}
                {guest.is_plus_one && (
                  <input
                    type="text"
                    placeholder={t('rsvp.guestName')}
                    value={guest.name || ''}
                    onChange={(e) => handleNameChange(idx, e.target.value)}
                    className={`w-full bg-transparent border-b border-hairline text-sm py-1 outline-none text-stone-200 placeholder:italic placeholder:text-stone-600 focus:border-ink/50 transition-colors duration-300 ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
          <LuxuryInput
            label={t('rsvp.emailLabel')}
            id="email"
            type="email"
            value={contact.email}
            onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
            required
            placeholder={t('rsvp.emailPlaceholder')}
          />
          <LuxuryInput
            label={t('rsvp.phoneLabel')}
            id="phone"
            type="tel"
            value={contact.phone}
            onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
            required
            placeholder={t('rsvp.phonePlaceholder')}
          />
        </div>

        {/* SMS Consent */}
        <div className="mb-8 flex items-start gap-3">
          <input
            type="checkbox"
            id="sms-consent"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-hairline bg-transparent text-wedding-gold focus:ring-wedding-gold focus:ring-offset-0"
          />
          <label htmlFor="sms-consent" className="text-xs leading-relaxed text-stone-400 font-sans tracking-wide cursor-pointer">
            {t('rsvp.smsConsent')}
            <Link
              href="/legal"
              className="ml-1 text-wedding-gold/80 hover:text-wedding-gold underline transition-colors"
            >
              {t('rsvp.privacyPolicy')}
            </Link>
          </label>
        </div>

        {/* Message */}
        <div className="mb-10">
          <LuxuryTextarea
            label={t('rsvp.noteLabel')}
            id="message"
            value={contact.message}
            onChange={(e) => setContact((p) => ({ ...p, message: e.target.value }))}
            rows={3}
            placeholder={t('rsvp.notePlaceholder')}
          />
        </div>

        {/* Error Message */}
        {submitError && (
          <p className={`text-sm italic text-center mb-6 text-red-500 ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
            {submitError}
          </p>
        )}

        {/* Submit */}
        <div className="flex justify-center">
          <button type="submit" disabled={isSubmitting || guests.length === 0} className={`${btnClass} ${isAmharic ? 'font-ethiopic normal-case tracking-normal' : ''}`}>
            {isSubmitting ? t('rsvp.submitting') : t('rsvp.submitButton')}
          </button>
        </div>

        {/* Not my family escape hatch */}
        {onNotMyFamily && (
          <p className="text-center mt-10">
            <button
              type="button"
              onClick={onNotMyFamily}
              className={`text-[11px] tracking-widest text-stone-600 hover:text-stone-400 transition-colors duration-300 uppercase border-b border-stone-700 hover:border-stone-500 pb-px ${isAmharic ? 'font-ethiopic normal-case tracking-normal' : 'font-sans'}`}
            >
              {t('rsvp.notMyFamily').replace('{name}', party.party_name)}
            </button>
          </p>
        )}
      </form>
    </div>
  );
}

// ============================================================================
// SUCCESS SCREEN
// ============================================================================
function SuccessScreen({ partyName, onBack }: { partyName: string; onBack: () => void }) {
  const { t, language } = useLanguage();
  const isAmharic = language === 'am';

  return (
    <div className="w-full max-w-md flex flex-col items-center">
      {/* Back Button */}
      <div className="w-full flex justify-start">
        <button
          onClick={onBack}
          className={`mb-8 text-sm tracking-wide flex items-center gap-2 text-stone-500 hover:text-stone-300 transition-colors ${isAmharic ? 'font-ethiopic' : 'font-serif'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('rsvp.goBack')}
        </button>
      </div>

      <div className="text-center">
        {/* Checkmark icon */}
        <div className="w-20 h-20 rounded-full border border-wedding-gold/30 flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-wedding-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Thank you message */}
        <h3 className={`text-3xl md:text-4xl mb-4 text-stone-200 ${isAmharic ? 'font-ethiopic font-light' : 'font-display'}`}>
          {t('rsvp.thankYouTitle')}
        </h3>
        <p className={`text-lg italic leading-relaxed text-stone-400 ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
          {t('rsvp.thankYouMessage').replace('{name}', partyName)}
        </p>

        {/* Registry note */}
        <div className="mt-10 pt-8 border-t border-hairline">
          <p className={`text-base leading-relaxed text-stone-400 mb-6 ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
            {t('rsvp.registryNote')}
          </p>

          <a
            href="/#registry"
            className={`inline-block px-8 py-3 font-medium text-sm tracking-widest uppercase transition-all duration-300 border border-wedding-gold/50 text-wedding-gold rounded hover:bg-wedding-gold/10 hover:border-wedding-gold ${isAmharic ? 'font-ethiopic normal-case tracking-normal' : ''}`}
          >
            {t('rsvp.viewRegistry')}
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RESPONDED CONFIRMATION SCREEN
// ============================================================================
function RespondedConfirmationScreen({
  party,
  onEdit,
  onNotMyFamily,
}: {
  party: Party;
  onEdit: () => void;
  onNotMyFamily?: () => void;
}) {
  const { t, language } = useLanguage();
  const isAmharic = language === 'am';

  return (
    <div className="w-full max-w-md flex flex-col items-center text-center">

      {/* Gold checkmark ring */}
      <div className="w-16 h-16 rounded-full border border-accent/30 flex items-center justify-center mx-auto mb-8">
        <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* Pre-header */}
      <p className={`text-[9px] tracking-[0.4em] uppercase text-accent/70 mb-4 ${isAmharic ? 'font-ethiopic' : 'font-sans'}`}>
        {t('rsvp.youreInvited')}
      </p>

      {/* Party name */}
      <h3 className={`text-3xl md:text-4xl text-accent-soft mb-8 leading-snug ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
        {party.party_name}
      </h3>

      {/* Warm confirmation message */}
      <p className={`italic text-base md:text-lg leading-relaxed text-stone-400 mb-12 px-2 ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
        {t('rsvp.alreadyRespondedConfirmation')}
      </p>

      {/* Registry link */}
      <a
        href="/#registry"
        className={`border border-accent/40 text-accent bg-transparent hover:bg-accent/8 px-8 py-3 rounded-full text-[10px] tracking-widest uppercase font-sans transition-all duration-300 mb-10 ${isAmharic ? 'font-ethiopic normal-case tracking-normal' : ''}`}
      >
        {t('rsvp.viewRegistry')}
      </a>

      {/* Edit escape hatch */}
      <button
        onClick={onEdit}
        className={`text-[10px] tracking-widest uppercase text-ink/35 hover:text-accent transition-colors duration-300 border-b border-hairline hover:border-accent/40 pb-px ${isAmharic ? 'font-ethiopic normal-case tracking-normal' : 'font-sans'}`}
      >
        {t('rsvp.editResponse')}
      </button>

      {/* Wrong family escape hatch */}
      {onNotMyFamily && (
        <button
          onClick={onNotMyFamily}
          className={`mt-6 text-[10px] tracking-widest uppercase text-stone-700 hover:text-stone-500 transition-colors duration-300 ${isAmharic ? 'font-ethiopic normal-case tracking-normal' : 'font-sans'}`}
        >
          {t('rsvp.notMyFamily').replace('{name}', party.party_name)}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
type View = 'search' | 'select' | 'form' | 'success' | 'already_responded';

export default function Rsvp() {
  const [view, setView] = useState<View>('search');
  const [party, setParty] = useState<Party | null>(null);
  const [candidates, setCandidates] = useState<Party[]>([]);
  const [vipLoading, setVipLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { t, language } = useLanguage();
  const { activeView } = useNavView();
  const isAmharic = language === 'am';

  // On mount: if a vip_party_id cookie exists, skip search and load the party directly
  useEffect(() => {
    const partyId = getVipPartyId();
    if (!partyId) return;

    setVipLoading(true);
    fetch('/api/rsvp/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partyId: decodeURIComponent(partyId) }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ party: p }) => {
        setParty(p);
        setView(p.has_responded ? 'already_responded' : 'form');
      })
      .catch(() => {
        // Cookie points to a stale/invalid party — clear it and fall back to search
        clearVipPartyId();
      })
      .finally(() => setVipLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFound = (p: Party) => {
    // Drop VIP cookie for organic users who searched manually
    setVipPartyId(p.id);
    setParty(p);
    if (p.has_responded) {
      setView('already_responded');
    } else {
      setView('form');
    }
  };

  const reset = () => {
    setView('search');
    setParty(null);
    setCandidates([]);
  };

  const resetAndClearVip = () => {
    clearVipPartyId();
    reset();
  };

  // Final Invite guests already RSVPed to Save the Date — no RSVP form for them.
  if (activeView === 'final-invite') return null;

  return (
    <section className="relative min-h-screen w-full">
      <div className="relative z-10 flex flex-col items-center pt-60 md:pt-64 pb-48 px-6 min-h-screen">
        <motion.div
          ref={revealRef}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="max-w-2xl w-full mx-auto flex flex-col items-center"
        >
          {/* Header */}
          <h2 className={`text-6xl tracking-wide mb-4 text-wedding-gold text-center ${isAmharic ? 'font-ethiopic font-light' : 'font-display'}`}>
            {t('rsvp.heading')}
          </h2>
          <p className={`text-base md:text-lg tracking-wide mb-12 text-stone-400 text-center ${isAmharic ? 'font-ethiopic font-light' : 'font-serif italic'}`}>
            {t('rsvp.deadline')}
          </p>

          {/* View Router */}
          {vipLoading && (
            <p className={`italic text-stone-500 text-sm animate-pulse ${isAmharic ? 'font-ethiopic' : 'font-serif'}`}>
              {t('rsvp.searching')}
            </p>
          )}

          {!vipLoading && view === 'search' && (
            <SearchScreen
              onFound={handleFound}
              onMultiple={(matches) => {
                setCandidates(matches);
                setView('select');
              }}
            />
          )}

          {!vipLoading && view === 'select' && (
            <SelectScreen
              parties={candidates}
              onSelect={handleFound}
              onBack={reset}
            />
          )}

          {!vipLoading && view === 'form' && party && (
            <FormScreen
              party={party}
              onSubmit={() => setView('success')}
              onBack={reset}
              onNotMyFamily={resetAndClearVip}
            />
          )}

          {!vipLoading && view === 'success' && party && (
            <SuccessScreen
              partyName={party.party_name}
              onBack={reset}
            />
          )}

          {!vipLoading && view === 'already_responded' && party && (
            isEditing ? (
              <FormScreen
                party={party}
                onSubmit={() => { setIsEditing(false); setView('success'); }}
                onBack={() => setIsEditing(false)}
              />
            ) : (
              <RespondedConfirmationScreen
                party={party}
                onEdit={() => setIsEditing(true)}
                onNotMyFamily={resetAndClearVip}
              />
            )
          )}
        </motion.div>
      </div>
    </section>
  );
}
