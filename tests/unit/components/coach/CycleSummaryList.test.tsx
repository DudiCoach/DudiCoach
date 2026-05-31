/// <reference types="vitest/globals" />

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import CycleSummaryList from "@/components/coach/CycleSummaryList";
import { pl } from "@/lib/i18n/pl";
import type { CycleSummary } from "@/lib/data/cycle-summary";

function makeSummary(overrides: Partial<CycleSummary> = {}): CycleSummary {
  return {
    id: "summary-uuid-001",
    athlete_id: "athlete-uuid-001",
    plan_id: "plan-uuid-001",
    cycle_number: 1,
    title: "Podsumowanie cyklu bazowego",
    notes: "Zawodnik poprawil technike",
    results: [
      { metric: "Przysiad", before: "80kg", after: "90kg", improvement: "+12.5%" },
    ],
    completed_at: "2026-04-24T10:00:00Z",
    created_at: "2026-04-24T10:00:00Z",
    updated_at: "2026-04-24T10:00:00Z",
    ...overrides,
  };
}

describe("CycleSummaryList", () => {
  it("renders empty state", () => {
    render(<CycleSummaryList summaries={[]} onCreateNew={vi.fn()} />);
    expect(screen.getByText(pl.coach.athlete.summaries.empty)).toBeInTheDocument();
  });

  it("renders add button", () => {
    render(<CycleSummaryList summaries={[]} onCreateNew={vi.fn()} />);
    expect(screen.getByRole("button", { name: pl.common.add })).toBeInTheDocument();
  });

  it("calls onCreateNew when add button clicked", () => {
    const onCreateNew = vi.fn();
    render(<CycleSummaryList summaries={[]} onCreateNew={onCreateNew} />);
    screen.getByRole("button", { name: pl.common.add }).click();
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it("renders summary title and cycle number", () => {
    render(<CycleSummaryList summaries={[makeSummary()]} onCreateNew={vi.fn()} />);
    expect(screen.getByText("Podsumowanie cyklu bazowego")).toBeInTheDocument();
    expect(screen.getByText(/Cykl 1/)).toBeInTheDocument();
  });

  it("expands to show notes and results", () => {
    render(<CycleSummaryList summaries={[makeSummary()]} onCreateNew={vi.fn()} />);
    
    fireEvent.click(screen.getByTestId("summary-summary-uuid-001"));

    expect(screen.getByText("Zawodnik poprawil technike")).toBeInTheDocument();
    expect(screen.getByText("Przysiad")).toBeInTheDocument();
    expect(screen.getByText("80kg")).toBeInTheDocument();
    expect(screen.getByText("90kg")).toBeInTheDocument();
    expect(screen.getByText("+12.5%")).toBeInTheDocument();
  });

  it("renders multiple summaries", () => {
    render(
      <CycleSummaryList
        summaries={[makeSummary({ id: "s1", title: "Cykl 1", cycle_number: 1 }), makeSummary({ id: "s2", title: "Cykl 2", cycle_number: 2 })]}
        onCreateNew={vi.fn()}
      />,
    );
    expect(screen.getByText("Cykl 1")).toBeInTheDocument();
    expect(screen.getByText("Cykl 2")).toBeInTheDocument();
  });
});
