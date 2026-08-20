/// <reference types="vitest/globals" />

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ProgressionChart from "@/components/coach/ProgressionChart";

const entries = [
  { entry_date: "2026-07-01", weight_kg: 80 },
  { entry_date: "2026-07-15", weight_kg: 85 },
  { entry_date: "2026-08-01", weight_kg: 90 },
];

describe("ProgressionChart", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(
      <ProgressionChart entries={[]} exerciseName="Przysiad" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one bar per entry with the exercise in the aria-label", () => {
    const { container } = render(
      <ProgressionChart entries={entries} exerciseName="Przysiad" />,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Wykres obciążeń dla Przysiad",
    );
    expect(container.querySelectorAll("rect")).toHaveLength(3);
  });

  it("shows weight tooltips per bar", () => {
    const { container } = render(
      <ProgressionChart entries={entries} exerciseName="Przysiad" />,
    );
    const titles = [...container.querySelectorAll("title")].map(
      (node) => node.textContent,
    );
    expect(titles).toContain("2026-07-01: 80 kg");
    expect(titles).toContain("2026-08-01: 90 kg");
  });

  it("handles a single flat entry without crashing (padded domain)", () => {
    const { container } = render(
      <ProgressionChart entries={[{ entry_date: "2026-08-01", weight_kg: 100 }]} exerciseName="MC" />,
    );
    expect(container.querySelectorAll("rect")).toHaveLength(1);
  });

  it("handles identical weights without division by zero", () => {
    const { container } = render(
      <ProgressionChart
        entries={[
          { entry_date: "2026-07-01", weight_kg: 100 },
          { entry_date: "2026-08-01", weight_kg: 100 },
        ]}
        exerciseName="MC"
      />,
    );
    expect(container.querySelectorAll("rect")).toHaveLength(2);
  });
});