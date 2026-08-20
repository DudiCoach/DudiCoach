import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const isoDateSchema = z
  .string()
  .regex(isoDateRegex)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Nieprawdziwa data w polu entry_date");

export const createProgressionSchema = z.object({
  exercise_name: z.string().trim().min(1).max(100),
  entry_date: isoDateSchema,
  weight_kg: z.number().positive().max(9999.9),
  reps: z.string().trim().max(20).optional(),
  sets: z.string().trim().max(20).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const updateProgressionSchema = createProgressionSchema.partial();

export type CreateProgressionInput = z.input<typeof createProgressionSchema>;
export type UpdateProgressionInput = z.input<typeof updateProgressionSchema>;

/** Collapses runs of whitespace to single spaces and trims the edges
 * (API-side normalization that complements the DB's
 * case/leading-trailing-insensitive unique index). */
export function normalizeExerciseName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}