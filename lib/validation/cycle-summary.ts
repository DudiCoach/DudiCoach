import { z } from "zod";

/**
 * Zod schema for cycle result validation.
 */
export const cycleResultSchema = z.object({
  metric: z.string().min(1).max(100),
  before: z.string().min(1).max(100),
  after: z.string().min(1).max(100),
  improvement: z.string().max(100).optional(),
});

/**
 * Zod schema for cycle summary validation.
 */
export const cycleSummarySchema = z.object({
  plan_id: z.string().min(1),
  cycle_number: z.number().int().min(1),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  results: z.array(cycleResultSchema).optional(),
});

export type CycleSummaryInput = z.infer<typeof cycleSummarySchema>;

/**
 * Zod schema for updating a cycle summary.
 */
export const updateCycleSummarySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
  results: z.array(cycleResultSchema).optional(),
});

export type UpdateCycleSummaryInput = z.infer<typeof updateCycleSummarySchema>;
