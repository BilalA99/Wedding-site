import { EVENT_SLUGS, type EventSlug } from "@/config/wedding";

export interface EventChoice {
  attending: boolean | null;
  size: number;
}

export interface WizardDraft {
  submissionId: string;
  primaryName: string;
  choices: Record<EventSlug, EventChoice>;
  memberNames: string[];
  email: string;
  phone: string;
  message: string;
}

const DRAFT_KEY = "bj-rsvp-draft";

export function emptyDraft(): WizardDraft {
  const choices = {} as Record<EventSlug, EventChoice>;
  for (const slug of EVENT_SLUGS) {
    choices[slug] = { attending: null, size: 2 };
  }
  return {
    submissionId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-fallback`,
    primaryName: "",
    choices,
    memberNames: [],
    email: "",
    phone: "",
    message: "",
  };
}

export function loadDraft(): WizardDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<WizardDraft>;
    const base = emptyDraft();
    return {
      ...base,
      ...parsed,
      choices: { ...base.choices, ...(parsed.choices ?? {}) },
      submissionId: parsed.submissionId || base.submissionId,
    };
  } catch {
    return emptyDraft();
  }
}

export function saveDraft(draft: WizardDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage full/unavailable — draft persistence is best-effort
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
}

export function buildSubmission(draft: WizardDraft) {
  return {
    client_submission_id: draft.submissionId,
    primary_name: draft.primaryName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    message: draft.message.trim(),
    member_names: draft.memberNames.map((n) => n.trim()).filter(Boolean),
    responses: EVENT_SLUGS.map((slug) => ({
      event_slug: slug,
      attending: draft.choices[slug].attending === true,
      party_size:
        draft.choices[slug].attending === true ? draft.choices[slug].size : 0,
    })),
    website: "",
  };
}

export function anyAttending(draft: WizardDraft): boolean {
  return EVENT_SLUGS.some((slug) => draft.choices[slug].attending === true);
}
