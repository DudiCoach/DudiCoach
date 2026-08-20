/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { pl } from "@/lib/i18n/pl";
import ProgressionCreateForm from "@/components/coach/ProgressionCreateForm";

const mockUseCreateProgression = vi.fn();

vi.mock("@/lib/hooks/use-progressions", () => ({
  useCreateProgression: (...args: unknown[]) =>
    mockUseCreateProgression(...(args as [])),
}));

function setupMutation(overrides: Partial<ReturnType<typeof mockUseCreateProgression>> = {}) {
  const mutateAsync = vi.fn().mockResolvedValue({ id: "entry-1" });
  mockUseCreateProgression.mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync,
    ...overrides,
  });
  return { mutateAsync };
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(pl.coach.athlete.progressions.field.exerciseName), {
    target: { value: "Przysiad" },
  });
  fireEvent.change(screen.getByLabelText(pl.coach.athlete.progressions.field.weight), {
    target: { value: "100" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProgressionCreateForm", () => {
  it("renders all fields with an empty date defaulting to today", () => {
    setupMutation();
    render(
      <ProgressionCreateForm
        athleteId="a1"
        onClose={vi.fn()}
        exerciseSuggestions={["Przysiad"]}
      />,
    );
    expect(
      screen.getByLabelText(pl.coach.athlete.progressions.field.exerciseName),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(pl.coach.athlete.progressions.field.weight),
    ).toBeInTheDocument();
    const dateInput = screen.getByLabelText(
      pl.coach.athlete.progressions.field.entryDate,
    ) as HTMLInputElement;
    expect(dateInput.value).toBe(new Date().toISOString().slice(0, 10));
    expect(screen.getByRole("button", { name: pl.common.cancel })).toBeInTheDocument();
  });

  it("keeps submit disabled until a valid exercise and weight are provided", () => {
    setupMutation();
    render(
      <ProgressionCreateForm athleteId="a1" onClose={vi.fn()} exerciseSuggestions={[]} />,
    );

    const submit = screen.getByRole("button", {
      name: pl.coach.athlete.progressions.createSubmit,
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(pl.coach.athlete.progressions.field.exerciseName), {
      target: { value: "Przysiad" },
    });
    expect(submit).toBeDisabled();

    fillValidForm();
    expect(submit).toBeEnabled();
  });

  it("shows validation messages for missing exercise and invalid weight", () => {
    setupMutation();
    render(
      <ProgressionCreateForm athleteId="a1" onClose={vi.fn()} exerciseSuggestions={[]} />,
    );

    fireEvent.change(screen.getByLabelText(pl.coach.athlete.progressions.field.weight), {
      target: { value: "0" },
    });
    expect(
      screen.getByText(pl.coach.athlete.progressions.validation.weightInvalid),
    ).toBeInTheDocument();
    expect(
      screen.getByText(pl.coach.athlete.progressions.field.exerciseNameRequired),
    ).toBeInTheDocument();
  });

  it("calls mutateAsync with the normalized payload and closes on success", async () => {
    const { mutateAsync } = setupMutation();
    const onClose = vi.fn();
    render(
      <ProgressionCreateForm
        athleteId="a1"
        onClose={onClose}
        exerciseSuggestions={["Przysiad"]}
      />,
    );

    fillValidForm();
    fireEvent.change(screen.getByLabelText(pl.coach.athlete.progressions.field.reps), {
      target: { value: " 6 " },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: pl.coach.athlete.progressions.createSubmit })
        .closest("form")!,
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        exercise_name: "Przysiad",
        entry_date: new Date().toISOString().slice(0, 10),
        weight_kg: 100,
        reps: "6",
        sets: undefined,
        note: undefined,
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the conflict message inline and keeps the form open on 409", async () => {
    const { mutateAsync } = setupMutation({
      error: new Error(
        "Wpis progresji dla tego ćwiczenia i dnia już istnieje.",
      ),
    });
    mutateAsync.mockRejectedValue(
      new Error("Wpis progresji dla tego ćwiczenia i dnia już istnieje."),
    );
    const onClose = vi.fn();
    render(
      <ProgressionCreateForm athleteId="a1" onClose={onClose} exerciseSuggestions={[]} />,
    );

    fillValidForm();
    fireEvent.submit(
      screen.getByRole("button", { name: pl.coach.athlete.progressions.createSubmit })
        .closest("form")!,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Wpis progresji dla tego ćwiczenia i dnia już istnieje."),
      ).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("disables the form while submitting", async () => {
    const { mutateAsync } = setupMutation({ isPending: true });
    render(
      <ProgressionCreateForm athleteId="a1" onClose={vi.fn()} exerciseSuggestions={[]} />,
    );

    expect(
      screen.getByRole("button", { name: pl.coach.athlete.progressions.creating }),
    ).toBeDisabled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("closes via the cancel button", () => {
    setupMutation();
    const onClose = vi.fn();
    render(
      <ProgressionCreateForm athleteId="a1" onClose={onClose} exerciseSuggestions={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: pl.common.cancel }));
    expect(onClose).toHaveBeenCalled();
  });
});