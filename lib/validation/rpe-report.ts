import { z } from "zod";

/**
 * Zod schema for RPE (Rate of Perceived Exertion) reporting.
 * Extends session feedback with structured RPE and pain data.
 */
export const rpeReportSchema = z.object({
  plan_id: z.string().min(1),
  week_number: z.number().int().min(1).max(4),
  day_number: z.number().int().min(1).max(7),
  rpe: z.number().int().min(1).max(10),
  pain_level: z.number().int().min(0).max(10).optional(),
  pain_location: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export type RpeReportInput = z.infer<typeof rpeReportSchema>;

/**
 * Zod schema for public athlete RPE endpoint (includes share_code).
 */
export const publicRpeReportSchema = z.object({
  share_code: z.string().length(6),
  plan_id: z.string().min(1),
  week_number: z.number().int().min(1).max(4),
  day_number: z.number().int().min(1).max(7),
  rpe: z.number().int().min(1).max(10),
  pain_level: z.number().int().min(0).max(10).optional(),
  pain_location: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export type PublicRpeReportInput = z.infer<typeof publicRpeReportSchema>;
