/// <reference types="vitest/globals" />

import { describe, it, expect } from "vitest";

import {
  createDiagnosticSchema,
  updateDiagnosticSchema,
} from "@/lib/validation/diagnostic";

const validInput = {
  muscle_key: "anterior_deltoid",
  side: "left",
  severity: "weak",
  observed_at: "2026-08-19",
  notes: "Stabilizator barku",
};

describe("createDiagnosticSchema", () => {
  it("accepts a valid input", () => {
    expect(createDiagnosticSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts nullish notes and omits observed_at default handling in UI", () => {
    const { success } = createDiagnosticSchema.safeParse({
      ...validInput,
      notes: undefined,
    });
    expect(success).toBe(true);
  });

  it("rejects an unknown muscle key", () => {
    const result = createDiagnosticSchema.safeParse({
      ...validInput,
      muscle_key: "not_a_muscle",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid side", () => {
    const result = createDiagnosticSchema.safeParse({
      ...validInput,
      side: "middle",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid severity", () => {
    const result = createDiagnosticSchema.safeParse({
      ...validInput,
      severity: "perfect",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed date", () => {
    const result = createDiagnosticSchema.safeParse({
      ...validInput,
      observed_at: "19-08-2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a calendar-impossible date", () => {
    const result = createDiagnosticSchema.safeParse({
      ...validInput,
      observed_at: "2026-02-31",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a leap-day date", () => {
    const result = createDiagnosticSchema.safeParse({
      ...validInput,
      observed_at: "2024-02-29",
    });
    expect(result.success).toBe(true);
  });

  it("rejects notes longer than 1000 characters", () => {
    const result = createDiagnosticSchema.safeParse({
      ...validInput,
      notes: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts notes of exactly 1000 characters", () => {
    const result = createDiagnosticSchema.safeParse({
      ...validInput,
      notes: "x".repeat(1000),
    });
    expect(result.success).toBe(true);
  });
});

describe("updateDiagnosticSchema", () => {
  it("accepts a partial update", () => {
    expect(
      updateDiagnosticSchema.safeParse({ severity: "dysfunction" }).success,
    ).toBe(true);
    expect(
      updateDiagnosticSchema.safeParse({ muscle_key: "soleus", side: "right" })
        .success,
    ).toBe(true);
  });

  it("accepts an empty patch", () => {
    expect(updateDiagnosticSchema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid values in a partial patch", () => {
    expect(updateDiagnosticSchema.safeParse({ side: "top" }).success).toBe(false);
    expect(updateDiagnosticSchema.safeParse({ observed_at: "2026/08/19" }).success).toBe(false);
  });
});
