import { describe, expect, it } from "vitest";

import { rsvpSubmissionSchema, rsvpUpdateSchema } from "@/lib/validation";
import { MAX_PARTY_SIZE } from "@/config/wedding";

const base = {
  client_submission_id: "3f2f1f38-9d1c-4e7a-b7f3-0a4c8f7a1e2d",
  primary_name: "The Ahmad Family",
  responses: [
    { event_slug: "henna", attending: true, party_size: 4 },
    { event_slug: "wedding", attending: true, party_size: 6 },
  ],
};

describe("rsvpSubmissionSchema", () => {
  it("accepts henna-only attendance", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "henna", attending: true, party_size: 3 },
        { event_slug: "wedding", attending: false, party_size: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts wedding-only attendance", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "henna", attending: false, party_size: 0 },
        { event_slug: "wedding", attending: true, party_size: 5 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts both events with different counts", () => {
    const result = rsvpSubmissionSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responses[0]!.party_size).toBe(4);
      expect(result.data.responses[1]!.party_size).toBe(6);
    }
  });

  it("accepts declining both events", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "henna", attending: false, party_size: 0 },
        { event_slug: "wedding", attending: false, party_size: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts party size of exactly 1 and exactly the max", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "henna", attending: true, party_size: 1 },
        { event_slug: "wedding", attending: true, party_size: MAX_PARTY_SIZE },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative counts", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "henna", attending: true, party_size: -1 },
        { event_slug: "wedding", attending: false, party_size: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects counts above the maximum", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "henna", attending: true, party_size: MAX_PARTY_SIZE + 1 },
        { event_slug: "wedding", attending: false, party_size: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects attending with a zero count", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "henna", attending: true, party_size: 0 },
        { event_slug: "wedding", attending: false, party_size: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects declining with a positive count", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "henna", attending: false, party_size: 2 },
        { event_slug: "wedding", attending: false, party_size: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      primary_name: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty-string email (optional field)", () => {
    const result = rsvpSubmissionSchema.safeParse({ ...base, email: "" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event slug", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "reception", attending: true, party_size: 2 },
        { event_slug: "wedding", attending: false, party_size: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate event responses", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [
        { event_slug: "henna", attending: true, party_size: 2 },
        { event_slug: "henna", attending: false, party_size: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing responses for an event", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      responses: [{ event_slug: "henna", attending: true, party_size: 2 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra fields", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      admin: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid client_submission_id", () => {
    const result = rsvpSubmissionSchema.safeParse({
      ...base,
      client_submission_id: "1234",
    });
    expect(result.success).toBe(false);
  });
});

describe("rsvpUpdateSchema", () => {
  it("accepts a partial update of responses only", () => {
    const result = rsvpUpdateSchema.safeParse({
      responses: [{ event_slug: "wedding", attending: true, party_size: 3 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid attending type", () => {
    const result = rsvpUpdateSchema.safeParse({
      responses: [{ event_slug: "wedding", attending: "yes", party_size: 3 }],
    });
    expect(result.success).toBe(false);
  });
});
