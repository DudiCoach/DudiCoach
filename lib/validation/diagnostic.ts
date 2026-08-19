import { z } from "zod";

import { MUSCLE_KEYS } from "@/lib/constants/muscles";

const sideValues = ["left", "right"] as const;
const severityValues = ["weak", "very_weak", "dysfunction"] as const;

export const SIDES = sideValues;
export const SEVERITIES = severityValues;

export const sideSchema = z.enum(sideValues);
export const severitySchema = z.enum(severityValues);

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const isoDateSchema = z
  .string()
  .regex(isoDateRegex)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Nieprawdziwa data w polu observed_at");

export const createDiagnosticSchema = z.object({
  muscle_key: z.enum(MUSCLE_KEYS),
  side: sideSchema,
  severity: severitySchema,
  notes: z.string().max(1000).nullish(),
  observed_at: isoDateSchema,
});

export const updateDiagnosticSchema = createDiagnosticSchema.partial();

export type CreateDiagnosticInput = z.input<typeof createDiagnosticSchema>;
export type UpdateDiagnosticInput = z.input<typeof updateDiagnosticSchema>;