"use client";

import { useState } from "react";

import { EVENTS, MAX_PARTY_SIZE, type EventSlug } from "@/config/wedding";
import type { PartyRecord } from "@/lib/rsvp-service";

import { updateRsvpAction } from "./actions";

interface FormChoice {
  attending: boolean;
  size: number;
}

export function ManageForm({
  token,
  party,
}: {
  token: string;
  party: PartyRecord;
}) {
  const initialChoices = {} as Record<EventSlug, FormChoice>;
  for (const event of EVENTS) {
    const resp = party.responses.find((r) => r.event_slug === event.slug);
    initialChoices[event.slug] = {
      attending: resp?.attending ?? false,
      size: resp && resp.party_size > 0 ? resp.party_size : 2,
    };
  }

  const [choices, setChoices] =
    useState<Record<EventSlug, FormChoice>>(initialChoices);
  const [primaryName, setPrimaryName] = useState(party.primary_name);
  const [email, setEmail] = useState(party.email ?? "");
  const [phone, setPhone] = useState(party.phone ?? "");
  const [message, setMessage] = useState(party.message ?? "");
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!primaryName.trim()) {
      setError("Please keep a name on the RSVP.");
      return;
    }
    setStatus("saving");
    setError(null);

    const result = await updateRsvpAction(token, {
      primary_name: primaryName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim(),
      responses: EVENTS.map((event) => ({
        event_slug: event.slug,
        attending: choices[event.slug].attending,
        party_size: choices[event.slug].attending
          ? choices[event.slug].size
          : 0,
      })),
    });

    if (result.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 4000);
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-8"
    >
      <div>
        <label
          htmlFor="manage-name"
          className="type-caps mb-2 block text-[0.65rem] text-sand"
        >
          Name
        </label>
        <input
          id="manage-name"
          type="text"
          value={primaryName}
          onChange={(e) => setPrimaryName(e.target.value)}
          className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 text-base text-ivory"
        />
      </div>

      {EVENTS.map((event) => {
        const choice = choices[event.slug];
        return (
          <fieldset
            key={event.slug}
            className="hairline rounded-lg border bg-charcoal-soft/40 p-5"
          >
            <legend className="type-caps px-2 text-[0.65rem] text-thread-bright">
              {event.name} · {event.dateLabel}
            </legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={choice.attending}
                onClick={() =>
                  setChoices((c) => ({
                    ...c,
                    [event.slug]: { ...c[event.slug], attending: true },
                  }))
                }
                className={`min-h-12 rounded-lg border px-4 py-3 text-left font-display transition-colors ${
                  choice.attending
                    ? "border-gold/80 bg-gold/10 text-gold-soft"
                    : "hairline text-ivory hover:border-ivory/40"
                }`}
              >
                Attending
              </button>
              <button
                type="button"
                aria-pressed={!choice.attending}
                onClick={() =>
                  setChoices((c) => ({
                    ...c,
                    [event.slug]: { ...c[event.slug], attending: false },
                  }))
                }
                className={`min-h-12 rounded-lg border px-4 py-3 text-left font-display transition-colors ${
                  !choice.attending
                    ? "border-gold/80 bg-gold/10 text-gold-soft"
                    : "hairline text-ivory hover:border-ivory/40"
                }`}
              >
                Unable to attend
              </button>
            </div>

            {choice.attending && (
              <div className="mt-4 flex items-center justify-between gap-4">
                <label
                  htmlFor={`size-${event.slug}`}
                  className="text-sm text-ivory/85"
                >
                  Guests (including you)
                </label>
                <input
                  id={`size-${event.slug}`}
                  type="number"
                  min={1}
                  max={MAX_PARTY_SIZE}
                  value={choice.size}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    setChoices((c) => ({
                      ...c,
                      [event.slug]: {
                        ...c[event.slug],
                        size: Number.isNaN(parsed)
                          ? 1
                          : Math.min(MAX_PARTY_SIZE, Math.max(1, parsed)),
                      },
                    }));
                  }}
                  className="hairline w-24 rounded-lg border bg-charcoal px-3 py-2.5 text-center text-base text-ivory"
                />
              </div>
            )}
          </fieldset>
        );
      })}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="manage-email"
            className="type-caps mb-2 block text-[0.65rem] text-sand"
          >
            Email (optional)
          </label>
          <input
            id="manage-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 text-base text-ivory"
          />
        </div>
        <div>
          <label
            htmlFor="manage-phone"
            className="type-caps mb-2 block text-[0.65rem] text-sand"
          >
            Phone (optional)
          </label>
          <input
            id="manage-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 text-base text-ivory"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="manage-message"
          className="type-caps mb-2 block text-[0.65rem] text-sand"
        >
          Note for the couple (optional)
        </label>
        <textarea
          id="manage-message"
          rows={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 text-base text-ivory"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-thread/50 bg-thread/10 px-4 py-3 text-sm text-ivory"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-4">
        <span aria-live="polite" className="text-sm text-gold-soft">
          {status === "saved" ? "Saved — thank you!" : ""}
        </span>
        <button
          type="submit"
          disabled={status === "saving"}
          className="type-caps min-h-12 rounded-full border border-gold/70 bg-gold/10 px-9 py-3 text-[0.7rem] text-gold-soft transition-all hover:bg-gold/20 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
