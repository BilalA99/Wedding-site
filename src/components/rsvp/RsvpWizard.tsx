"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  EVENTS,
  EVENT_SLUGS,
  getEvent,
  type EventSlug,
} from "@/config/wedding";
import { TatreezCluster } from "@/components/tatreez/Tatreez";
import { CountStepper } from "./CountStepper";
import {
  anyAttending,
  buildSubmission,
  clearDraft,
  loadDraft,
  saveDraft,
  type WizardDraft,
} from "./wizard-state";

const EASE = [0.22, 1, 0.36, 1] as const;

type Step = "welcome" | EventSlug | "names" | "contact" | "review" | "success";

interface SuccessState {
  manageToken: string | null;
}

const stepVariants = {
  enter: { opacity: 0, y: 24 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -18 },
};

const inputClass =
  "w-full rounded-sm border border-line-blue bg-paper px-4 py-3.5 text-base text-ink placeholder:text-ink-soft/50 transition-colors duration-300 focus:border-dusty";

const labelClass = "type-caps mb-2 block text-[0.62rem] text-blue-deep";

export function RsvpWizard() {
  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [duplicateHint, setDuplicateHint] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Restore any draft after hydration (rAF avoids sync setState in effect).
  useEffect(() => {
    const id = requestAnimationFrame(() => setDraft(loadDraft()));
    return () => cancelAnimationFrame(id);
  }, []);

  const update = useCallback((patch: Partial<WizardDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  const updateChoice = useCallback(
    (slug: EventSlug, patch: Partial<WizardDraft["choices"][EventSlug]>) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          choices: {
            ...prev.choices,
            [slug]: { ...prev.choices[slug], ...patch },
          },
        };
        saveDraft(next);
        return next;
      });
    },
    [],
  );

  const goTo = useCallback((next: Step) => {
    setStep(next);
    setSubmitError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  }, []);

  if (!draft) {
    return <div className="min-h-80" aria-hidden="true" />;
  }

  const stepsOrder: Step[] = [
    "welcome",
    ...EVENT_SLUGS,
    ...(anyAttending(draft) ? (["names"] as Step[]) : []),
    "contact",
    "review",
  ];
  const stepIndex = stepsOrder.indexOf(step);

  const continueFromWelcome = async () => {
    const name = draft.primaryName.trim();
    if (!name) {
      setNameError("Please tell us your name.");
      return;
    }
    setNameError(null);
    goTo(EVENT_SLUGS[0]!);
    // Advisory duplicate check — never blocks.
    try {
      const res = await fetch("/api/rsvp/check-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { exists?: boolean };
      setDuplicateHint(Boolean(data.exists));
    } catch {
      setDuplicateHint(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSubmission(draft)),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        manageToken?: string | null;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setSubmitError(
          data.error ??
            "Something went wrong sending your RSVP. Please try again.",
        );
        setSubmitting(false);
        return;
      }
      setSuccess({ manageToken: data.manageToken ?? null });
      setStep("success");
      clearDraft();
      liveRef.current?.setAttribute("data-done", "1");
    } catch {
      setSubmitError(
        "We couldn't reach the server. Your answers are saved — please try again.",
      );
      setSubmitting(false);
    }
  };

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.5, ease: EASE };

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Progress stitches */}
      {step !== "success" && (
        <div
          className="mb-10 flex items-center justify-center gap-2"
          aria-hidden="true"
        >
          {stepsOrder.map((s, i) => (
            <span
              key={s}
              className={`block h-[3px] rounded-full transition-all duration-500 ${
                i <= stepIndex ? "w-8 bg-dusty" : "w-4 bg-powder"
              }`}
            />
          ))}
        </div>
      )}

      <p ref={liveRef} aria-live="polite" className="sr-only">
        {step === "success"
          ? "RSVP received. Thank you."
          : `Step ${Math.max(stepIndex + 1, 1)} of ${stepsOrder.length}`}
      </p>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
        >
          {step === "welcome" && (
            <div>
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="type-display text-3xl text-ink outline-none md:text-4xl"
              >
                Your reply
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                One RSVP covers your whole party — you can adjust each
                celebration separately.
              </p>
              <div className="mt-8">
                <label htmlFor="primary-name" className={labelClass}>
                  Your name
                </label>
                <input
                  id="primary-name"
                  type="text"
                  autoComplete="name"
                  value={draft.primaryName}
                  onChange={(e) => update({ primaryName: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") continueFromWelcome();
                  }}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? "name-error" : undefined}
                  className={inputClass}
                  placeholder="e.g. The Ahmad Family"
                />
                {nameError && (
                  <p id="name-error" className="mt-2 text-sm text-error">
                    {nameError}
                  </p>
                )}
              </div>
              <WizardNav onNext={continueFromWelcome} nextLabel="Continue" />
            </div>
          )}

          {EVENT_SLUGS.includes(step as EventSlug) && (
            <EventStep
              slug={step as EventSlug}
              draft={draft}
              updateChoice={updateChoice}
              duplicateHint={duplicateHint && step === EVENT_SLUGS[0]}
              onDismissHint={() => setDuplicateHint(false)}
              headingRef={headingRef}
              onBack={() => {
                const idx = EVENT_SLUGS.indexOf(step as EventSlug);
                goTo(idx === 0 ? "welcome" : EVENT_SLUGS[idx - 1]!);
              }}
              onNext={() => {
                const idx = EVENT_SLUGS.indexOf(step as EventSlug);
                if (idx < EVENT_SLUGS.length - 1) goTo(EVENT_SLUGS[idx + 1]!);
                else goTo(anyAttending(draft) ? "names" : "contact");
              }}
            />
          )}

          {step === "names" && (
            <NamesStep
              draft={draft}
              update={update}
              headingRef={headingRef}
              onBack={() => goTo(EVENT_SLUGS[EVENT_SLUGS.length - 1]!)}
              onNext={() => goTo("contact")}
            />
          )}

          {step === "contact" && (
            <ContactStep
              draft={draft}
              update={update}
              headingRef={headingRef}
              onBack={() =>
                goTo(
                  anyAttending(draft)
                    ? "names"
                    : EVENT_SLUGS[EVENT_SLUGS.length - 1]!,
                )
              }
              onNext={() => goTo("review")}
            />
          )}

          {step === "review" && (
            <ReviewStep
              draft={draft}
              headingRef={headingRef}
              submitting={submitting}
              submitError={submitError}
              onBack={() => goTo("contact")}
              onEdit={(s) => goTo(s)}
              onSubmit={submit}
            />
          )}

          {step === "success" && success && (
            <SuccessStep draft={draft} success={success} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-10 flex items-center justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="type-caps min-h-11 px-3 py-2 text-[0.62rem] text-ink-soft transition-colors hover:text-ink"
        >
          ← Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="group type-caps inline-flex min-h-12 items-center gap-2 rounded-sm bg-blue-deep px-8 py-3 text-[0.68rem] text-paper-pure transition-colors duration-300 hover:bg-ink disabled:opacity-40"
      >
        {nextLabel}
        <span
          aria-hidden="true"
          className="transition-transform duration-300 group-hover:translate-x-1"
        >
          →
        </span>
      </button>
    </div>
  );
}

function EventStep({
  slug,
  draft,
  updateChoice,
  duplicateHint,
  onDismissHint,
  headingRef,
  onBack,
  onNext,
}: {
  slug: EventSlug;
  draft: WizardDraft;
  updateChoice: (
    slug: EventSlug,
    patch: Partial<WizardDraft["choices"][EventSlug]>,
  ) => void;
  duplicateHint: boolean;
  onDismissHint: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onNext: () => void;
}) {
  const event = getEvent(slug);
  const choice = draft.choices[slug];

  return (
    <div>
      {duplicateHint && (
        <div className="mb-6 rounded-sm border border-powder bg-ice p-4 text-sm text-ink">
          <p>
            We may already have an RSVP under this name. If you&rsquo;ve
            responded before, use the management link from your confirmation to
            make changes — or continue if this is a different party.
          </p>
          <button
            type="button"
            onClick={onDismissHint}
            className="type-caps mt-3 min-h-9 text-[0.6rem] text-blue-deep"
          >
            This is a different party →
          </button>
        </div>
      )}

      <p className="type-caps text-[0.6rem] text-blue-deep">
        {event.weekday} · {event.dateLabel} · {event.timeLabel}
      </p>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="type-display mt-2 text-3xl text-ink outline-none md:text-4xl"
      >
        The {event.name}
      </h3>
      <p className="mt-2 text-sm text-ink-soft">
        {event.venue} · {event.city}, {event.region}
      </p>

      <fieldset className="mt-8">
        <legend className="sr-only">Will you attend the {event.name}?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceButton
            selected={choice.attending === true}
            onClick={() => updateChoice(slug, { attending: true })}
            title="Joyfully accept"
          />
          <ChoiceButton
            selected={choice.attending === false}
            onClick={() => updateChoice(slug, { attending: false })}
            title="Unable to attend"
            muted
          />
        </div>
      </fieldset>

      <AnimatePresence initial={false}>
        {choice.attending === true && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-6 rounded-sm border border-line-blue bg-ice p-5">
              <CountStepper
                idBase={`${slug}`}
                label={`Guests attending the ${event.name} (including you)`}
                value={choice.size}
                onChange={(size) => updateChoice(slug, { size })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <WizardNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={choice.attending === null}
      />
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  title,
  muted = false,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-13 rounded-sm border px-5 py-4 text-left font-display text-lg transition-all duration-300 ${
        selected
          ? "border-blue-deep bg-ice text-blue-deep"
          : `border-line-blue ${muted ? "text-ink-soft" : "text-ink"} hover:border-dusty`
      }`}
    >
      {title}
    </button>
  );
}

function NamesStep({
  draft,
  update,
  headingRef,
  onBack,
  onNext,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onNext: () => void;
}) {
  const maxNeeded = Math.max(
    ...EVENT_SLUGS.map((s) =>
      draft.choices[s].attending ? draft.choices[s].size : 0,
    ),
  );
  const names = draft.memberNames.slice(0, maxNeeded);
  while (names.length < maxNeeded) names.push("");

  return (
    <div>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="type-display text-3xl text-ink outline-none md:text-4xl"
      >
        Who will be joining you?
      </h3>
      <p className="mt-3 text-sm text-ink-soft">
        Optional — your headcount is already saved.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {names.map((name, i) => (
          <input
            key={i}
            type="text"
            value={name}
            onChange={(e) => {
              const next = [...names];
              next[i] = e.target.value;
              update({ memberNames: next });
            }}
            aria-label={`Guest ${i + 1} name`}
            placeholder={
              i === 0 ? draft.primaryName || "Guest 1" : `Guest ${i + 1}`
            }
            className={inputClass}
          />
        ))}
      </div>

      <div className="mt-4 text-right">
        <button
          type="button"
          onClick={onNext}
          className="type-caps min-h-9 text-[0.6rem] text-ink-soft transition-colors hover:text-ink"
        >
          Skip for now
        </button>
      </div>

      <WizardNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

function ContactStep({
  draft,
  update,
  headingRef,
  onBack,
  onNext,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="type-display text-3xl text-ink outline-none md:text-4xl"
      >
        A way to reach you
      </h3>
      <p className="mt-3 text-sm text-ink-soft">
        Optional — helpful if plans change.
      </p>

      <div className="mt-8 flex flex-col gap-5">
        <div>
          <label htmlFor="rsvp-email" className={labelClass}>
            Email
          </label>
          <input
            id="rsvp-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={draft.email}
            onChange={(e) => update({ email: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="rsvp-phone" className={labelClass}>
            Phone
          </label>
          <input
            id="rsvp-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={draft.phone}
            onChange={(e) => update({ phone: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="rsvp-message" className={labelClass}>
            A note for the couple
          </label>
          <textarea
            id="rsvp-message"
            rows={3}
            maxLength={2000}
            value={draft.message}
            onChange={(e) => update({ message: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Review" />
    </div>
  );
}

function ReviewStep({
  draft,
  headingRef,
  submitting,
  submitError,
  onBack,
  onEdit,
  onSubmit,
}: {
  draft: WizardDraft;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onEdit: (step: EventSlug) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="type-display text-3xl text-ink outline-none md:text-4xl"
      >
        One last look
      </h3>
      <p className="mt-2 text-sm text-ink-soft">{draft.primaryName}</p>

      <dl className="mt-8 flex flex-col gap-4">
        {EVENTS.map((event) => {
          const choice = draft.choices[event.slug];
          return (
            <div
              key={event.slug}
              className="flex items-center justify-between rounded-sm border border-line-blue bg-ice px-5 py-4"
            >
              <div>
                <dt className="font-display text-xl text-ink">{event.name}</dt>
                <dd className="mt-1 text-sm text-ink-soft">
                  {choice.attending
                    ? `Attending · ${choice.size} ${choice.size === 1 ? "guest" : "guests"}`
                    : "Unable to attend"}
                </dd>
              </div>
              <button
                type="button"
                onClick={() => onEdit(event.slug)}
                className="type-caps min-h-11 px-3 text-[0.6rem] text-blue-deep transition-colors hover:text-ink"
                aria-label={`Edit ${event.name} response`}
              >
                Edit
              </button>
            </div>
          );
        })}
      </dl>

      {submitError && (
        <div
          role="alert"
          className="mt-6 rounded-sm border border-error/40 bg-error/5 px-4 py-3 text-sm text-error"
        >
          {submitError}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="type-caps min-h-11 px-3 py-2 text-[0.62rem] text-ink-soft transition-colors hover:text-ink"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="type-caps min-h-12 rounded-sm bg-blue-deep px-9 py-3 text-[0.68rem] text-paper-pure transition-colors duration-300 hover:bg-ink disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Confirm RSVP"}
        </button>
      </div>
    </div>
  );
}

function SuccessStep({
  draft,
  success,
}: {
  draft: WizardDraft;
  success: SuccessState;
}) {
  const [copied, setCopied] = useState(false);
  const manageUrl = success.manageToken
    ? `/rsvp/manage/${success.manageToken}`
    : null;

  const copyLink = async () => {
    if (!manageUrl) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${manageUrl}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="text-center">
      <div className="is-drawn mx-auto flex w-24 justify-center text-dusty">
        <TatreezCluster className="w-24" />
      </div>
      <h3 className="type-display mt-6 text-3xl text-ink md:text-4xl">
        RSVP received
      </h3>
      <p className="mt-3 text-sm text-ink-soft">
        We look forward to celebrating with you.
      </p>

      <dl className="mx-auto mt-8 flex max-w-sm flex-col gap-3 text-left">
        {EVENTS.map((event) => {
          const choice = draft.choices[event.slug];
          return (
            <div
              key={event.slug}
              className="flex items-center justify-between rounded-sm border border-line-blue bg-ice px-5 py-3.5"
            >
              <dt className="font-display text-lg text-ink">{event.name}</dt>
              <dd className="text-sm text-ink-soft">
                {choice.attending ? `Attending · ${choice.size}` : "Declined"}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {EVENTS.filter((e) => draft.choices[e.slug].attending).map((e) => (
          <a
            key={e.slug}
            href={`/api/calendar/${e.slug}`}
            className="type-caps min-h-11 rounded-sm border border-powder px-5 py-3 text-[0.6rem] text-blue-deep transition-colors hover:border-dusty"
          >
            {e.name} calendar
          </a>
        ))}
      </div>

      {manageUrl && (
        <div className="mx-auto mt-10 max-w-md rounded-sm border border-line-blue bg-ice p-5 text-left">
          <p className="type-caps text-[0.6rem] text-blue-deep">
            Plans may change
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Keep this private link to update your RSVP at any time:
          </p>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={manageUrl}
              className="block flex-1 truncate rounded-sm bg-paper-pure px-3 py-2 font-mono text-xs text-blue-deep"
            >
              {manageUrl}
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="type-caps min-h-10 shrink-0 rounded-sm border border-powder px-4 py-2 text-[0.6rem] text-blue-deep"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
