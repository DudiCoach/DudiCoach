/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import ProgressionCard from "@/components/coach/ProgressionCard";
import type { LoadProgression } from "@/lib/api/progressions";

const mockUseUpdateProgression = vi.fn();
const mockUseDeleteProgression = vi.fn();

vi.mock("@/lib/hooks/use-progressions", () => ({
  useUpdateProgression: (...args: unknown[]) =>
    mockUseUpdateProgression(...(args as [])),
  useDeleteProgression: (...args: unknown[]) =>
    mockUseDeleteProgression(...(args as [])),
}));

function makeEntry(overrides: Partial<LoadProgression> = {}): LoadProgression {
  return {
    id: "entry-uuid-001",
    athlete_id: "athlete-uuid-001",
    exercise_name: "Przysiad ze sztanga",
    entry_date: "2026-08-01",
    weight_kg: 100,
    reps: "6",
    sets: "3",
    note: "notatka",
    source: "coach",
    created_at: "2026-08-01T12:00:00Z",
    updated_at: "2026-08-01T12:00:00Z",
    ...overrides,
  };
}

function setupMutations() {
  const updateMutate = vi.fn();
  const deleteMutate = vi.fn();
  mockUseUpdateProgression.mockReturnValue({
    isPending: false,
    error: null,
    mutate: updateMutate,
  });
  mockUseDeleteProgression.mockReturnValue({
    isPending: false,
    error: null,
    mutate: deleteMutate,
  });
  return { updateMutate, deleteMutate };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProgressionCard", () => {
  it("shows the exercise name and entry count", () => {
    setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad ze sztanga"
        entries={[makeEntry()]}
      />,
    );
    expect(screen.getByText("Przysiad ze sztanga")).toBeInTheDocument();
    expect(screen.getByText(/1 wpis/)).toBeInTheDocument();
  });

  it("shows an up badge with the delta when weight increased", () => {
    setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[
          makeEntry({ id: "e1", entry_date: "2026-07-01", weight_kg: 80 }),
          makeEntry({ id: "e2", entry_date: "2026-08-01", weight_kg: 85 }),
        ]}
      />,
    );
    expect(screen.getByText("▲ 5 kg")).toBeInTheDocument();
  });

  it("shows a down badge with the absolute delta when weight decreased", () => {
    setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[
          makeEntry({ id: "e1", entry_date: "2026-07-01", weight_kg: 90 }),
          makeEntry({ id: "e2", entry_date: "2026-08-01", weight_kg: 85 }),
        ]}
      />,
    );
    expect(screen.getByText("▼ 5 kg")).toBeInTheDocument();
  });

  it("shows an unchanged badge when the weight stayed the same", () => {
    setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[
          makeEntry({ id: "e1", entry_date: "2026-07-01", weight_kg: 85 }),
          makeEntry({ id: "e2", entry_date: "2026-08-01", weight_kg: 85 }),
        ]}
      />,
    );
    expect(screen.getByText("— bez zmian")).toBeInTheDocument();
  });

  it("hides the badge with fewer than two entries", () => {
    setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[makeEntry()]}
      />,
    );
    expect(screen.queryByText(/▲|▼|— bez zmian/)).not.toBeInTheDocument();
  });

  it("persists a weight change on blur and shows the saved state", () => {
    const { updateMutate } = setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[makeEntry()]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Przysiad/i }));
    fireEvent.change(screen.getByLabelText(/Obciążenie/i), {
      target: { value: "110" },
    });
    fireEvent.blur(screen.getByLabelText(/Obciążenie/i));

    expect(updateMutate).toHaveBeenCalledWith(
      { entryId: "entry-uuid-001", input: { weight_kg: 110 } },
      expect.any(Object),
    );
    const onSuccess = updateMutate.mock.calls[0][1].onSuccess as () => void;
    act(() => onSuccess());
    expect(screen.getByText("Zapisano")).toBeInTheDocument();
  });

  it("does not re-PATCH the weight on blur after a successful save", () => {
    const { updateMutate } = setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[makeEntry()]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Przysiad/i }));
    const weightInput = screen.getByLabelText(/Obciążenie/i);
    fireEvent.change(weightInput, { target: { value: "110" } });
    fireEvent.blur(weightInput);
    expect(updateMutate).toHaveBeenCalledTimes(1);

    const onSuccess = updateMutate.mock.calls[0][1].onSuccess as () => void;
    act(() => onSuccess());
    fireEvent.blur(weightInput);
    expect(updateMutate).toHaveBeenCalledTimes(1);
  });

  it("reverts the weight to the persisted value when the save fails", () => {
    const { updateMutate } = setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[makeEntry()]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Przysiad/i }));
    const weightInput = screen.getByLabelText(/Obciążenie/i);
    fireEvent.change(weightInput, { target: { value: "110" } });
    fireEvent.blur(weightInput);
    const onError = updateMutate.mock.calls[0][1].onError as () => void;
    act(() => onError());

    expect(screen.getByLabelText(/Obciążenie/i)).toHaveValue(100);
    expect(screen.getByText("Błąd zapisu")).toBeInTheDocument();
  });

  it("reverts reps to the persisted value when the save fails", () => {
    const { updateMutate } = setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[makeEntry()]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Przysiad/i }));
    const repsInput = screen.getByLabelText(/Powtórzenia/i);
    fireEvent.change(repsInput, { target: { value: "8" } });
    fireEvent.blur(repsInput);
    const onError = updateMutate.mock.calls[0][1].onError as () => void;
    act(() => onError());

    expect(screen.getByLabelText(/Powtórzenia/i)).toHaveValue("6");
    expect(screen.getByText("Błąd zapisu")).toBeInTheDocument();
  });

  it("does not PATCH when the weight is unchanged on blur", () => {
    const { updateMutate } = setupMutations();
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[makeEntry()]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Przysiad/i }));
    fireEvent.blur(screen.getByLabelText(/Obciążenie/i));
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("deletes only after a confirmed dialog", () => {
    const { deleteMutate } = setupMutations();
    const confirmMock = vi.fn().mockReturnValue(false);
    window.confirm = confirmMock;
    render(
      <ProgressionCard
        athleteId="a1"
        exerciseName="Przysiad"
        entries={[makeEntry()]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Przysiad/i }));
    fireEvent.click(screen.getByRole("button", { name: /Usuń/i }));
    expect(deleteMutate).not.toHaveBeenCalled();

    confirmMock.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Usuń/i }));
    expect(deleteMutate).toHaveBeenCalledWith({ entryId: "entry-uuid-001" });
  });
});