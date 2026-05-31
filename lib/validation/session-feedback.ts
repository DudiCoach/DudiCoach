import { z } from "zod";

/**
 * Zod schema for session feedback validation.
 * Matches the acceptance criteria in US-014.
 */
export const sessionFeedbackSchema = z.object({
  plan_id: z.string().min(1),
  week_number: z.number().int().min(1).max(4),
  day_number: z.number().int().min(1).max(7),
  feedback_text: z
    .string()
    .min(1, "Feedback text is required")
    .max(2000, "Feedback text must be 2000 characters or less")
    .trim()
    .refine(
      (text) => text.length > 0,
      "Feedback text cannot be empty or whitespace only",
    ),
});

export type SessionFeedbackInput = z.infer<typeof sessionFeedbackSchema>;

/**
 * Validation schema for public athlete endpoint (includes share_code).
 */
export const publicSessionFeedbackSchema = z.object({
  share_code: z.string().length(6),
  plan_id: z.string().min(1),
  week_number: z.number().int().min(1).max(4),
  day_number: z.number().int().min(1).max(7),
  feedback_text: z
    .string()
    .min(1, "Feedback text is required")
    .max(2000, "Feedback text must be 2000 characters or less")
    .trim()
    .refine(
      (text) => text.length > 0,
      "Feedback text cannot be empty or whitespace only",
    ),
});

export type PublicSessionFeedbackInput = z.infer<typeof publicSessionFeedbackSchema>;
