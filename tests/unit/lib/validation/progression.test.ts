/// <reference types="vitest/globals" />

import { describe, it, expect } from "vitest";

import {
  createProgressionSchema,
  updateProgressionSchema,
  normalizeExerciseName,
} from "@/lib/validation/progression";

const validInput = {
  exercise_name: "Przysiad ze sztanga",
  entry_date: "2026-08-19",
  weight_kg: 100,
};

describe("createProgressionSchema", () => {
  it("accepts a valid full input", () => {
    const result = createProgressionSchema.safeParse({
      ...validInput,
      reps: " 6 ",
      sets: "3x5",
      note: "Notatka",
    });
    expect(result.success).toBe(true);
  });

  it("trims exercise_name and required fields are non-empty", () => {
    const result = createProgressionSchema.safeParse({
      exercise_name: "  ",
      entry_date: "2026-08-19",
      weight_kg: 100,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "exercise_name")).toBe(true);
    }
  });

  it("rejects exercise_name longer than 100 chars", () => {
    const result = createProgressionSchema.safeParse({
      ...validInput,
      exercise_name: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects weight outside [0.1, 9999.9]", () => {
    for (const weight_kg of [0, 0.05, -5, 10000]) {
      const result = createProgressionSchema.safeParse({ ...validInput, weight_kg });
      expect(result.success).toBe(false);
    }
  });

  it("accepts a weight of 9999.9 and 0.1", () => {
    expect(
      createProgressionSchema.safeParse({ ...validInput, weight_kg: 9999.9 }).success,
    ).toBe(true);
    expect(
      createProgressionSchema.safeParse({ ...validInput, weight_kg: 0.1 }).success,
    ).toBe(true);
  });

  it("rejects a non-ISO or impossible date", () => {
    for (const entry_date of ["19-08-2026", "2026-13-45", "2026-02-30"]) {
      const result = createProgressionSchema.safeParse({ ...validInput, entry_date });
      expect(result.success).toBe(false);
    }
  });

  it("rejects reps/sets/note longer than their caps", () => {
    const result = createProgressionSchema.safeParse({
      ...validInput,
      reps: "x".repeat(21),
      sets: "x".repeat(21),
      note: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProgressionSchema", () => {
  it("accepts a partial update", () => {
    expect(updateProgressionSchema.safeParse({ weight_kg: 110 }).success).toBe(true);
    expect(updateProgressionSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an invalid partial update", () => {
    expect(updateProgressionSchema.safeParse({ weight_kg: 0 }).success).toBe(false);
  });
});

describe("normalizeExerciseName", () => {
  it("collapses runs of whitespace to single spaces", () => {
    expect(normalizeExerciseName("  Przysiad   ze   sztanga\t\n")).toBe(
      "Przysiad ze sztanga",
    );
  });

  it("leaves a clean name unchanged", () => {
    expect(normalizeExerciseName("Martwy ciag")).toBe("Martwy ciag");
  });
});