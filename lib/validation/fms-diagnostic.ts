import { z } from "zod";

const regionValues = ["upper", "lower", "foot"] as const;
const sideValues = ["left", "right", "center"] as const;
const severityValues = ["weak", "very_weak", "dysfunction"] as const;

export const createFmsDiagnosticSchema = z.object({
  region: z.enum(regionValues),
  side: z.enum(sideValues),
  muscle: z.string().trim().min(1).max(200),
  severity: z.enum(severityValues),
  notes: z.string().max(1000).nullish(),
});

export const updateFmsDiagnosticSchema = createFmsDiagnosticSchema.partial();

export type CreateFmsDiagnosticInput = z.infer<
  typeof createFmsDiagnosticSchema
>;
export type UpdateFmsDiagnosticInput = z.infer<
  typeof updateFmsDiagnosticSchema
>;
