import { z } from "zod";

import { EVENT_SLUGS, MAX_PARTY_SIZE } from "@/config/wedding";

const trimmedString = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(max));

export const eventResponseSchema = z
  .object({
    event_slug: z.enum(EVENT_SLUGS as [string, ...string[]]),
    attending: z.boolean(),
    party_size: z.int().min(0).max(MAX_PARTY_SIZE),
  })
  .superRefine((val, ctx) => {
    if (val.attending && val.party_size < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Party size must be at least 1 when attending",
        path: ["party_size"],
      });
    }
    if (!val.attending && val.party_size !== 0) {
      ctx.addIssue({
        code: "custom",
        message: "Party size must be 0 when not attending",
        path: ["party_size"],
      });
    }
  });

const emailSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.email().max(254));

const phoneSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(7)
      .max(40)
      .regex(/^[+\d][\d\s().-]+$/, "Enter a valid phone number"),
  );

export const rsvpSubmissionSchema = z
  .object({
    client_submission_id: z.uuid(),
    primary_name: trimmedString(120).pipe(z.string().min(1, "Please tell us your name")),
    email: z.union([emailSchema, z.literal("")]).optional(),
    phone: z.union([phoneSchema, z.literal("")]).optional(),
    message: trimmedString(2000).optional(),
    member_names: z.array(trimmedString(120)).max(MAX_PARTY_SIZE).optional(),
    responses: z
      .array(eventResponseSchema)
      .length(EVENT_SLUGS.length, "A response for each event is required")
      .refine(
        (rs) => new Set(rs.map((r) => r.event_slug)).size === rs.length,
        "Duplicate event response",
      ),
    // Honeypot — humans never fill this in.
    website: z.literal("").optional(),
  })
  .strict();

export type RsvpSubmission = z.infer<typeof rsvpSubmissionSchema>;

export const rsvpUpdateSchema = z
  .object({
    primary_name: trimmedString(120).pipe(z.string().min(1)).optional(),
    email: z.union([emailSchema, z.literal("")]).optional(),
    phone: z.union([phoneSchema, z.literal("")]).optional(),
    message: trimmedString(2000).optional(),
    member_names: z.array(trimmedString(120)).max(MAX_PARTY_SIZE).optional(),
    responses: z
      .array(eventResponseSchema)
      .max(EVENT_SLUGS.length)
      .refine(
        (rs) => new Set(rs.map((r) => r.event_slug)).size === rs.length,
        "Duplicate event response",
      )
      .optional(),
  })
  .strict();

export type RsvpUpdate = z.infer<typeof rsvpUpdateSchema>;
