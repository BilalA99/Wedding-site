"use client";

import { useState } from "react";

import { EVENTS, MAX_PARTY_SIZE, type EventSlug } from "@/config/wedding";
import type { PartyRecord } from "@/lib/rsvp-service";

import { updateRsvpAction } from "./actions";

interface FormChoice {
  attending: boolean;
  size: number;
}

const inputClass =
  "w-full rounded-sm border border-line-blue bg-paper px-4 py-3 text-base text-ink transition-colors duration-300 focus:border-dusty";

const labelClass = "type-caps mb-2 block text-[0.62rem] text-blue-deep";

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
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
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
        <label htmlFor="manage-name" className={labelClass}>
          Name
        </label>
        <input
          id="manage-name"
          type="text"
          value={primaryName}
          onChange={(e) => setPrimaryName(e.target.value)}
          className={inputClass}
        />
      </div>

      {EVENTS.map((event) => {
        const choice = choices[event.slug];
        return (
          <fieldset
            key={event.slug}
            className="rounded-sm border border-line-blue bg-ice p-5"
          >
            <legend className="type-caps px-2 text-[0.62rem] text-blue-deep">
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
                className={`min-h-12 rounded-sm border px-4 py-3 text-left font-display transition-colors ${
                  choice.attending
                    ? "border-blue-deep bg-paper-pure text-blue-deep"
                    : "border-line-blue text-ink hover:border-dusty"
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
                className={`min-h-12 rounded-sm border px-4 py-3 text-left font-display transition-colors ${
                  !choice.attending
                    ? "border-blue-deep bg-paper-pure text-blue-deep"
                    : "border-line-blue text-ink hover:border-dusty"
                }`}
              >
                Unable to attend
              </button>
            </div>

            {choice.attending && (
              <div className="mt-4 flex items-center justify-between gap-4">
                <label
                  htmlFor={`size-${event.slug}`}
                  className="text-sm text-ink"
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
                  className="w-24 rounded-sm border border-line-blue bg-paper-pure px-3 py-2.5 text-center text-base text-ink"
                />
              </div>
            )}
          </fieldset>
        );
      })}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="manage-email" className={labelClass}>
            Email (optional)
          </label>
          <input
            id="manage-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="manage-phone" className={labelClass}>
            Phone (optional)
          </label>
          <input
            id="manage-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="manage-message" className={labelClass}>
          Note for the couple (optional)
        </label>
        <textarea
          id="manage-message"
          rows={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-sm border border-error/40 bg-error/5 px-4 py-3 text-sm text-error"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-4">
        <span aria-live="polite" className="text-sm text-blue-deep">
          {status === "saved" ? "Saved — thank you!" : ""}
        </span>
        <button
          type="submit"
          disabled={status === "saving"}
          className="type-caps min-h-12 rounded-sm bg-blue-deep px-9 py-3 text-[0.68rem] text-paper-pure transition-colors duration-300 hover:bg-ink disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
