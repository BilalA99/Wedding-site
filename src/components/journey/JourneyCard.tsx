'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import Image from 'next/image';
import { JourneyItem } from './journeyData';
import { useLanguage } from '@/context/LanguageContext';
import { useOpacitySettle } from '@/hooks/useOpacitySettle';

interface JourneyCardProps {
  item: JourneyItem;
  index: number;
}

// ── Dual-POV parser ──────────────────────────────────────────────────────────
// Splits text on [Yoni] and [Saron] tags and renders them in distinct gold styles.
function ParsedDescription({
  text,
  alignEnd,
  isAmharic,
}: {
  text: string;
  alignEnd: boolean;
  isAmharic: boolean;
}) {
  const parts = text.split(/(\[(?:Yoni|Saron)\])/g);

  return (
    <p
      className={`text-sm text-ink/55 leading-relaxed max-w-[280px] ${
        isAmharic ? 'font-ethiopic' : 'font-sans'
      } ${alignEnd ? 'md:text-right' : ''}`}
    >
      {parts.map((part, i) => {
        if (part === '[Yoni]') {
          return (
            <span
              key={i}
              className="font-semibold tracking-wide"
              style={{ color: 'var(--accent)' }}
            >
              {isAmharic ? 'ዮኒ › ' : 'Yoni › '}
            </span>
          );
        }
        if (part === '[Saron]') {
          return (
            <span
              key={i}
              className="font-semibold tracking-wide"
              style={{ color: 'var(--accent-soft)' }}
            >
              {isAmharic ? 'ሳሮን › ' : 'Saron › '}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export default function JourneyCard({ item, index }: JourneyCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isLeft = index % 2 === 0;
  const isInView = useInView(cardRef, { once: true, amount: 0.25 });

  // Watchdog against these scroll-reveal opacity tweens getting stuck
  // mid-fade under heavy fast-scroll main-thread work — see useOpacitySettle.
  const dotRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  useOpacitySettle(dotRef, isInView, 1000);
  useOpacitySettle(frameRef, isInView, 1500);
  useOpacitySettle(textRef, isInView, 1800);

  const { language } = useLanguage();
  const isAmharic = language === 'am';

  const displayYear = isAmharic ? (item.amYear ?? item.year) : item.year;
  const displayTitle = isAmharic ? (item.amTitle ?? item.title) : item.title;
  const displayDescription = isAmharic ? (item.amDescription ?? item.description) : item.description;
  const displayCallout = isAmharic ? (item.amCallout ?? item.callout) : item.callout;

  // Per-card scroll: drives image parallax within the museum frame
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'end start'],
  });

  // Image translates -8% → +8% as card moves through the viewport
  const imageY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);

  return (
    <div
      ref={cardRef}
      className={`relative flex flex-col md:flex-row ${
        !isLeft ? 'md:flex-row-reverse' : ''
      } items-center gap-8 md:gap-0 pt-6 pb-20 md:pb-36`}
    >
      {/* Thread dot — mobile: left edge, desktop: horizontal center */}
      <div className="absolute left-6 top-7 md:left-1/2 md:-translate-x-1/2 z-10">
        <motion.div
          ref={dotRef}
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="w-3 h-3 rounded-full bg-wedding-gold"
          style={{ boxShadow: '0 0 12px 3px rgba(var(--accent-rgb), 0.45)' }}
        />
      </div>

      {/* ── Museum frame side ── */}
      <div
        className={`w-full md:w-1/2 flex justify-center pl-14 md:pl-0 ${
          isLeft ? 'md:justify-end md:pr-16' : 'md:justify-start md:pl-16'
        }`}
      >
        <motion.div
          ref={frameRef}
          initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: isLeft ? -30 : 30 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="relative"
          style={{ width: 340, maxWidth: '100%' }}
        >
          {/* Year watermark — massive, 7% opacity, sits behind the frame */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
            <span
              className={`leading-none text-wedding-gold ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}
              style={{ fontSize: 170, opacity: 0.07 }}
            >
              {item.year.replace(/[^0-9]/g, '').slice(0, 4)}
            </span>
          </div>

          {/* Museum frame — generous padding, portrait orientation */}
          <div
            className="relative z-10 border border-wedding-gold/25 bg-surface-alt p-[18px]"
            style={{ aspectRatio: '3/4' }}
          >
            {/* Gold corner accents */}
            <div className="absolute top-1.5 left-1.5 w-5 h-5 border-t border-l border-wedding-gold/55" />
            <div className="absolute top-1.5 right-1.5 w-5 h-5 border-t border-r border-wedding-gold/55" />
            <div className="absolute bottom-1.5 left-1.5 w-5 h-5 border-b border-l border-wedding-gold/55" />
            <div className="absolute bottom-1.5 right-1.5 w-5 h-5 border-b border-r border-wedding-gold/55" />

            {/* Inner clipping container — overflow:hidden masks the parallax image */}
            <div className="relative w-full h-full overflow-hidden">
              {item.image ? (
                <motion.div
                  style={{
                    y: imageY,
                    position: 'absolute',
                    // Extend 10% beyond edges so Y translation never reveals empty space
                    top: '-10%',
                    left: '-5%',
                    right: '-5%',
                    bottom: '-10%',
                  }}
                >
                  <Image
                    src={item.image}
                    alt={displayTitle}
                    fill
                    sizes="340px"
                    // object-top preserves faces; no aggressive center-crop
                    className="object-cover object-top"
                  />
                </motion.div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-surface-alt to-surface flex items-center justify-center">
                  <span className={`text-wedding-gold/20 text-5xl ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>{displayYear}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Text side — blur-to-focus reveal ── */}
      <div
        className={`w-full md:w-1/2 pl-14 md:pl-0 flex flex-col ${
          isLeft
            ? 'items-start md:items-start md:pl-16'
            : 'items-start md:items-end md:pr-16'
        }`}
      >
        <motion.div
          ref={textRef}
          initial={{ opacity: 0, filter: 'blur(10px)', x: isLeft ? 30 : -30 }}
          animate={
            isInView
              ? { opacity: 1, filter: 'blur(0px)', x: 0 }
              : { opacity: 0, filter: 'blur(10px)', x: isLeft ? 30 : -30 }
          }
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className={`flex flex-col ${!isLeft ? 'md:items-end md:text-right' : 'items-start'}`}
        >
          {/* Year label */}
          <p className={`text-wedding-gold/60 uppercase tracking-[0.4em] text-xs mb-3 ${isAmharic ? 'font-ethiopic not-italic normal-case tracking-normal' : 'font-sans'}`}>
            {displayYear}
          </p>

          {/* Milestone title */}
          <h3 className={`text-2xl md:text-3xl text-ink-heading mb-3 leading-tight ${isAmharic ? 'font-ethiopic font-light' : 'font-serif'}`}>
            {displayTitle}
          </h3>

          {/* Gold accent line */}
          <div className={`w-8 h-[1px] bg-wedding-gold/40 mb-4 ${!isLeft ? 'md:ml-auto' : ''}`} />

          {/* Description with dual-POV styling */}
          <ParsedDescription text={displayDescription} alignEnd={!isLeft} isAmharic={isAmharic} />

          {/* Optional callout — e.g. pointer to another section */}
          {displayCallout && (
            <a
              href="#home"
              className={`mt-4 inline-block text-xs text-wedding-gold/60 hover:text-wedding-gold tracking-wide italic transition-colors ${!isLeft ? 'md:self-end' : ''} ${isAmharic ? 'font-ethiopic not-italic' : 'font-sans'}`}
            >
              {displayCallout}
            </a>
          )}
        </motion.div>
      </div>
    </div>
  );
}
