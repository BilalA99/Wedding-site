"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { EVENTS, MAX_PARTY_SIZE, type EventSlug } from "@/config/wedding";
import type { PartyRecord } from "@/lib/rsvp-service";

import {
  adminDeleteRsvpAction,
  adminUpdateRsvpAction,
} from "../../actions";

interface FormChoice {
  attending: boolean;
  size: number;
}

export function EditRsvpForm({ party }: { party: PartyRecord }) {
  const router = useRouter();
  const initial = {} as Record<EventSlug, FormChoice>;
  for (const event of EVENTS) {
    const r = party.responses.find((x) => x.event_slug === event.slug);
    initial[event.slug] = {
      attending: r?.attending ?? false,
      size: r && r.party_size > 0 ? r.party_size : 1,
    };
  }

  const [name, setName] = useState(party.primary_name);
  const [email, setEmail] = useState(party.email ?? "");
  const [phone, setPhone] = useState(party.phone ?? "");
  const [message, setMessage] = useState(party.message ?? "");
  const [members, setMembers] = useState(party.member_names.join("\n"));
  const [choices, setChoices] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);

    const result = await adminUpdateRsvpAction(party.id, {
      primary_name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim(),
      member_names: members
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean),
      responses: EVENTS.map((event) => ({
        event_slug: event.slug,
        attending: choices[event.slug].attending,
        party_size: choices[event.slug].attending
          ? choices[event.slug].size
          : 0,
      })),
    });

    setBusy(false);
    if (result.ok) {
      setFeedback("Saved.");
      router.refresh();
    } else {
      setError(result.error ?? "Save failed.");
    }
  };

  const remove = async () => {
    setBusy(true);
    const result = await adminDeleteRsvpAction(party.id);
    setBusy(false);
    if (result.ok) {
      router.push("/admin/rsvps");
      router.refresh();
    } else {
      setError(result.error ?? "Delete failed.");
      setConfirmingDelete(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <div>
        <label htmlFor="edit-name" className="type-caps mb-2 block text-[0.65rem] text-sand">
          Primary name
        </label>
        <input
          id="edit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 text-base text-ivory"
        />
      </div>

      {EVENTS.map((event) => {
        const c = choices[event.slug];
        return (
          <fieldset
            key={event.slug}
            className="hairline rounded-lg border bg-charcoal-soft/40 p-4"
          >
            <legend className="type-caps px-2 text-[0.62rem] text-thread-bright">
              {event.name}
            </legend>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-ivory">
                <input
                  type="checkbox"
                  checked={c.attending}
                  onChange={(e) =>
                    setChoices((prev) => ({
                      ...prev,
                      [event.slug]: {
                        ...prev[event.slug],
                        attending: e.target.checked,
                      },
                    }))
                  }
                  className="h-4 w-4 accent-[#b0955f]"
                />
                Attending
              </label>
              {c.attending && (
                <label className="flex items-center gap-2 text-sm text-ivory/85">
                  Guests
                  <input
                    type="number"
                    min={1}
                    max={MAX_PARTY_SIZE}
                    value={c.size}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      setChoices((prev) => ({
                        ...prev,
                        [event.slug]: {
                          ...prev[event.slug],
                          size: Number.isNaN(parsed)
                            ? 1
                            : Math.min(MAX_PARTY_SIZE, Math.max(1, parsed)),
                        },
                      }));
                    }}
                    className="hairline w-20 rounded-lg border bg-charcoal px-3 py-2 text-center text-ivory"
                  />
                </label>
              )}
            </div>
          </fieldset>
        );
      })}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-email" className="type-caps mb-2 block text-[0.65rem] text-sand">
            Email
          </label>
          <input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 text-base text-ivory"
          />
        </div>
        <div>
          <label htmlFor="edit-phone" className="type-caps mb-2 block text-[0.65rem] text-sand">
            Phone
          </label>
          <input
            id="edit-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 text-base text-ivory"
          />
        </div>
      </div>

      <div>
        <label htmlFor="edit-members" className="type-caps mb-2 block text-[0.65rem] text-sand">
          Guest names (one per line)
        </label>
        <textarea
          id="edit-members"
          rows={3}
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 text-sm text-ivory"
        />
      </div>

      <div>
        <label htmlFor="edit-message" className="type-caps mb-2 block text-[0.65rem] text-sand">
          Message
        </label>
        <textarea
          id="edit-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 text-sm text-ivory"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-thread-bright">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="type-caps min-h-10 text-[0.62rem] text-thread-bright/80 hover:text-thread-bright"
            >
              Delete RSVP
            </button>
          ) : (
            <span className="flex items-center gap-3 text-sm text-ivory/70">
              Delete permanently?
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="type-caps min-h-10 rounded-full border border-thread/60 px-4 py-2 text-[0.62rem] text-thread-bright"
              >
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="type-caps min-h-10 text-[0.62rem] text-ivory/50"
              >
                Cancel
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="text-sm text-gold-soft">
            {feedback ?? ""}
          </span>
          <button
            type="submit"
            disabled={busy}
            className="type-caps min-h-11 rounded-full border border-gold/70 bg-gold/10 px-7 py-2.5 text-[0.65rem] text-gold-soft disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
