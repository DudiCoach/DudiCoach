import { z } from "zod";

import { normalizeShareCode, SHARE_CODE_REGEX } from "@/lib/validation/share-code";

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

export const publicFeedbackPostBodySchema = z.object({
  weekNumber: feedbackWeekNumberSchema,
  dayNumber: feedbackDayNumberSchema,
  feedbackText: feedbackTextSchema,
});

export const publicFeedbackQuerySchema = z.object({
  weekNumber: z.coerce.number().pipe(feedbackWeekNumberSchema),
  dayNumber: z.coerce.number().pipe(feedbackDayNumberSchema),
});

export const shareCodePathSchema = z
  .string()
  .transform(normalizeShareCode)
  .refine((value) => SHARE_CODE_REGEX.test(value), {
    message: "Invalid share code format",
  });

export type PublicFeedbackPostBody = z.infer<typeof publicFeedbackPostBodySchema>;
export type PublicFeedbackQuery = z.infer<typeof publicFeedbackQuerySchema>;
