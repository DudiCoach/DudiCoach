/// <reference types="vitest/globals" />

import { describe, it, expect } from "vitest";

import {
  MUSCLES,
  MUSCLE_KEYS,
  getMuscleByKey,
  searchMuscles,
} from "@/lib/constants/muscles";

describe("muscle catalog", () => {
  it("contains exactly 68 muscles", () => {
    expect(MUSCLES.length).toBe(68);
  });

  it("has unique keys", () => {
    const keys = MUSCLES.map((muscle) => muscle.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has 30 upper, 24 lower and 14 foot muscles", () => {
    const count = (region: string) =>
      MUSCLES.filter((muscle) => muscle.region === region).length;
    expect(count("upper")).toBe(30);
    expect(count("lower")).toBe(24);
    expect(count("foot")).toBe(14);
  });

  it("exposes all keys through MUSCLE_KEYS", () => {
    expect(MUSCLE_KEYS).toHaveLength(MUSCLES.length);
    expect(MUSCLE_KEYS[0]).toBe("anterior_deltoid");
  });

  it("finds a muscle by key", () => {
    expect(getMuscleByKey("anterior_deltoid")).toMatchObject({
      namePl: "Naramienny przedni",
      nameLatin: "Anterior Deltoid",
      region: "upper",
    });
    expect(getMuscleByKey("missing_key")).toBeUndefined();
  });

  it("returns all muscles for an empty query", () => {
    expect(searchMuscles("")).toHaveLength(68);
    expect(searchMuscles("   ")).toHaveLength(68);
  });

  it("filters by Polish name", () => {
    const results = searchMuscles("naramienny");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((muscle) => muscle.namePl.includes("Naramienny"))).toBe(true);
  });

  it("filters by Latin name", () => {
    const results = searchMuscles("deltoid");
    expect(results).toHaveLength(3);
    expect(results.map((muscle) => muscle.key)).toEqual([
      "anterior_deltoid",
      "lateral_deltoid",
      "posterior_deltoid",
    ]);
  });

  it("is diacritic-insensitive (e.g. \"łydki\" matches \"Brzuchaty łydki\")", () => {
    const results = searchMuscles("lydki");
    expect(results.map((muscle) => muscle.key)).toContain("gastrocnemius");
  });
});
