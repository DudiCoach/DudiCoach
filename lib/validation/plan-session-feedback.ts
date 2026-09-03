import { z } from "zod";

import {
  normalizeShareCode,
  SHARE_CODE_REGEX,
} from "@/lib/validation/share-code";

export const feedbackPlanIdSchema = z.string().uuid("Invalid planId");
export const feedbackAthleteIdSchema = z.string().uuid("Invalid athleteId");

export const feedbackWeekNumberSchema = z
  .number()
  .int("weekNumber must be an integer")
  .min(1, "weekNumber must be between 1 and 4")
  .max(4, "weekNumber must be between 1 and 4");

export const feedbackDayNumberSchema = z
  .number()
  .int("dayNumber must be an integer")
  .min(1, "dayNumber must be between 1 and 7")
  .max(7, "dayNumber must be between 1 and 7");

const SESSION_STATUS_VALUES = ["completed", "partial", "skipped"] as const;
const PAIN_LOCATION_VALUES = [
  "head",
  "neck",
  "shoulder",
  "chest_ribs",
  "abdomen",
  "upper_back",
  "lower_back",
  "pelvis_sacrum",
  "arm",
  "elbow",
  "wrist_hand",
  "hip_groin",
  "buttock",
  "thigh",
  "knee",
  "lower_leg",
  "ankle_achilles",
  "foot",
  "other",
] as const;
const PAIN_SIDE_VALUES = ["left", "right", "bilateral", "central"] as const;
const WARSAW_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function warsawTodayDateString() {
  return WARSAW_DATE_FORMATTER.format(new Date());
}

function isCalendarDateString(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// Keep LF/TAB, strip the remaining C0 control chars.
const UNSAFE_CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

export function sanitizeFeedbackText(value: string): string {
  return value.replace(UNSAFE_CONTROL_CHARS_REGEX, "").trim();
}

export const feedbackTextSchema = z
  .string()
  .transform(sanitizeFeedbackText)
  .refine((value) => value.length > 0, {
    message: "feedbackText cannot be empty",
  })
  .refine((value) => value.length <= 2000, {
    message: "feedbackText must be at most 2000 characters",
  });

const optionalFeedbackTextSchema = z
  .union([feedbackTextSchema, z.null()])
  .optional()
  .transform((value) => value ?? null);

export const sessionOutcomeSchema = z
  .object({
    sessionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "sessionDate must use YYYY-MM-DD")
      .refine(isCalendarDateString, {
        message: "sessionDate must be a valid calendar date",
      })
      .refine((value) => value <= warsawTodayDateString(), {
        message: "sessionDate cannot be in the future",
      }),
    sessionStatus: z.enum(SESSION_STATUS_VALUES),
    sessionRpe: z.number().int().min(1).max(10).nullable(),
    wellbeing: z.number().int().min(1).max(5),
    painScore: z.number().int().min(0).max(10),
    painLocation: z.enum(PAIN_LOCATION_VALUES).nullable(),
    painSide: z.enum(PAIN_SIDE_VALUES).nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.sessionStatus === "skipped" && value.sessionRpe !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionRpe"],
        message: "sessionRpe must be null when sessionStatus is skipped",
      });
    }

    if (
      (value.sessionStatus === "completed" ||
        value.sessionStatus === "partial") &&
      value.sessionRpe === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionRpe"],
        message: "sessionRpe is required for completed or partial sessions",
      });
    }

    if (value.painSide !== null && value.painLocation === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["painSide"],
        message: "painSide requires painLocation",
      });
    }

    if (
      value.painScore === 0 &&
      (value.painLocation !== null || value.painSide !== null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["painScore"],
        message: "painScore 0 requires no painLocation or painSide",
      });
    }
  });

export const publicFeedbackLegacyPostBodySchema = z
  .object({
    weekNumber: feedbackWeekNumberSchema,
    dayNumber: feedbackDayNumberSchema,
    feedbackText: feedbackTextSchema,
  })
  .strict();

export const publicFeedbackV2PostBodySchema = z
  .object({
    contractVersion: z.literal(2),
    weekNumber: feedbackWeekNumberSchema,
    dayNumber: feedbackDayNumberSchema,
    feedbackText: optionalFeedbackTextSchema,
    outcome: sessionOutcomeSchema,
  })
  .strict();

export const publicFeedbackPostBodySchema = z.union([
  publicFeedbackLegacyPostBodySchema,
  publicFeedbackV2PostBodySchema,
]);

const contractVersionQuerySchema = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.coerce.number().pipe(z.literal(2)).optional(),
);

export const publicFeedbackQuerySchema = z.object({
  weekNumber: z.coerce.number().pipe(feedbackWeekNumberSchema),
  dayNumber: z.coerce.number().pipe(feedbackDayNumberSchema),
  contractVersion: contractVersionQuerySchema,
});

export const shareCodePathSchema = z
  .string()
  .transform(normalizeShareCode)
  .refine((value) => SHARE_CODE_REGEX.test(value), {
    message: "Invalid share code format",
  });

export type PublicFeedbackPostBody = z.infer<
  typeof publicFeedbackPostBodySchema
>;
export type PublicFeedbackQuery = z.infer<typeof publicFeedbackQuerySchema>;
export type SessionOutcome = z.infer<typeof sessionOutcomeSchema>;
