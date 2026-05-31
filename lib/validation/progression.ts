import { z } from "zod";

export const createProgressionSchema = z.object({
  exercise_name: z.string().trim().min(1).max(200),
  weight_kg: z.number().min(0).max(1000),
  reps: z.string().max(50).nullish(),
  sets: z.string().max(50).nullish(),
  note: z.string().max(1000).nullish(),
  source: z.enum(["coach", "athlete"]).default("coach"),
});

export const updateProgressionSchema = createProgressionSchema.partial();

export type CreateProgressionInput = z.infer<typeof createProgressionSchema>;
export type UpdateProgressionInput = z.infer<typeof updateProgressionSchema>;
