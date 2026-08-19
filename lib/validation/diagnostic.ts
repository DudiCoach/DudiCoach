import { z } from "zod";

import { MUSCLE_KEYS } from "@/lib/constants/muscles";

const sideValues = ["left", "right"] as const;
const severityValues = ["weak", "very_weak", "dysfunction"] as const;

export const SIDES = sideValues;
export const SEVERITIES = severityValues;

export const sideSchema = z.enum(sideValues);
export const severitySchema = z.enum(severityValues);

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createDiagnosticSchema = z.object({
  muscle_key: z.enum(MUSCLE_KEYS),
  side: sideSchema,
  severity: severitySchema,
  notes: z.string().max(1000).nullish(),
  observed_at: z.string().regex(isoDateRegex),
});

export const updateDiagnosticSchema = createDiagnosticSchema.partial();

export type CreateDiagnosticInput = z.input<typeof createDiagnosticSchema>;
export type UpdateDiagnosticInput = z.input<typeof updateDiagnosticSchema>;