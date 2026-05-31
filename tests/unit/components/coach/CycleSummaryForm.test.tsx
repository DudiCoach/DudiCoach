/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import CycleSummaryForm from "@/components/coach/CycleSummaryForm";
import { pl } from "@/lib/i18n/pl";

const mockMutateAsync = vi.fn();

vi.mock("@/lib/hooks/use-cycle-summaries", () => ({
  useCreateCycleSummary: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe("CycleSummaryForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it("renders form fields", () => {
    render(
      <CycleSummaryForm
        athleteId="athlete-1"
        planId="plan-1"
        cycleNumber={1}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(/Podsumowanie cyklu/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Obserwacje/)).toBeInTheDocument();
  });

  it("renders save and cancel buttons", () => {
    render(
      <CycleSummaryForm
        athleteId="athlete-1"
        planId="plan-1"
        cycleNumber={1}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: pl.common.save })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: pl.common.cancel })).toBeInTheDocument();
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    render(
      <CycleSummaryForm
        athleteId="athlete-1"
        planId="plan-1"
        cycleNumber={1}
        onSuccess={vi.fn()}
        onCancel={onCancel}
      />,
    );

    screen.getByRole("button", { name: pl.common.cancel }).click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("adds a result row when add button clicked", () => {
    render(
      <CycleSummaryForm
        athleteId="athlete-1"
        planId="plan-1"
        cycleNumber={1}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const addButton = screen.getByText("+ Dodaj wynik");
    fireEvent.click(addButton);

    expect(screen.getByPlaceholderText("Metryka")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Przed")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Po")).toBeInTheDocument();
  });

  it("calls mutateAsync on submit with form data", async () => {
    const onSuccess = vi.fn();
    render(
      <CycleSummaryForm
        athleteId="athlete-1"
        planId="plan-1"
        cycleNumber={1}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Podsumowanie cyklu/), {
      target: { value: "Test title" },
    });

    fireEvent.change(screen.getByPlaceholderText(/Obserwacje/), {
      target: { value: "Test notes" },
    });

    screen.getByRole("button", { name: pl.common.save }).click();

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: "plan-1",
        cycle_number: 1,
        title: "Test title",
        notes: "Test notes",
      }),
    );
  });

  it("does not submit when title is empty", () => {
    render(
      <CycleSummaryForm
        athleteId="athlete-1"
        planId="plan-1"
        cycleNumber={1}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    screen.getByRole("button", { name: pl.common.save }).click();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
