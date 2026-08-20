/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { pl } from "@/lib/i18n/pl";
import ProgressionsTab from "@/components/coach/ProgressionsTab";
import type { Athlete } from "@/lib/api/athletes";
import type { LoadProgression } from "@/lib/api/progressions";

const mockUseProgressions = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@/lib/hooks/use-progressions", () => ({
  useProgressions: (...args: unknown[]) =>
    mockUseProgressions(...(args as [])),
}));

vi.mock("@/components/coach/ProgressionCard", () => ({
  default: ({
    exerciseName,
    entries,
  }: {
    exerciseName: string;
    entries: LoadProgression[];
  }) => (
    <div data-testid="progression-card">
      {exerciseName}:{entries.length}
    </div>
  ),
}));

vi.mock("@/components/coach/ProgressionCreateForm", () => ({
  default: ({
    onSubmittingChange,
  }: {
    onSubmittingChange?: (isSubmitting: boolean) => void;
  }) => (
    <div data-testid="progression-create-form">
      <button type="button" onClick={() => onSubmittingChange?.(true)}>
        mark-submitting
      </button>
    </div>
  ),
}));

function makeAthlete(overrides: Partial<Athlete> = {}): Athlete {
  return {
    id: "athlete-uuid-001",
    coach_id: "coach-uuid-001",
    name: "Jan Kowalski",
    age: 25,
    weight_kg: 75.0,
    height_cm: 180.0,
    sport: "pilka_nozna",
    training_start_date: null,
    training_days_per_week: 5,
    session_minutes: 90,
    current_phase: "base",
    goal: "Zwiększenie wydolności",
    notes: null,
    share_code: "ABC234",
    share_active: false,
    created_at: "2026-04-10T10:00:00Z",
    updated_at: "2026-04-10T12:00:00Z",
    ...overrides,
  };
}

function makeEntry(overrides: Partial<LoadProgression> = {}): LoadProgression {
  return {
    id: "entry-uuid-001",
    athlete_id: "athlete-uuid-001",
    exercise_name: "Przysiad ze sztanga",
    entry_date: "2026-08-01",
    weight_kg: 100,
    reps: "6",
    sets: "3",
    note: null,
    source: "coach",
    created_at: "2026-08-01T12:00:00Z",
    updated_at: "2026-08-01T12:00:00Z",
    ...overrides,
  };
}

function setupQuery(overrides: Partial<ReturnType<typeof mockUseProgressions>> = {}) {
  mockUseProgressions.mockReturnValue({
    data: [],
    error: null,
    isLoading: false,
    isFetching: false,
    refetch: mockRefetch,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProgressionsTab", () => {
  it("shows the loading state while the first fetch is in flight", () => {
    setupQuery({ data: [], isLoading: true });
    render(<ProgressionsTab athlete={makeAthlete()} />);
    expect(
      screen.getByText(pl.coach.athlete.progressions.loading),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no entries", () => {
    setupQuery({ data: [] });
    render(<ProgressionsTab athlete={makeAthlete()} />);
    expect(
      screen.getByText(pl.coach.athlete.progressions.empty),
    ).toBeInTheDocument();
  });

  it("shows an error with a retry button when the query fails", () => {
    setupQuery({ data: [], error: new Error("boom") });
    render(<ProgressionsTab athlete={makeAthlete()} />);
    expect(
      screen.getByRole("alert").textContent,
    ).toContain(pl.coach.athlete.progressions.errorGeneric);
    fireEvent.click(screen.getByText(pl.common.tryAgain));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("groups entries by exercise name, sorted alphabetically", () => {
    setupQuery({
      data: [
        makeEntry({ id: "e1", exercise_name: "Przysiad" }),
        makeEntry({ id: "e2", exercise_name: "Martwy ciag" }),
        makeEntry({ id: "e3", exercise_name: "Przysiad", entry_date: "2026-07-01" }),
      ],
    });
    render(<ProgressionsTab athlete={makeAthlete()} />);

    const cards = screen.getAllByTestId("progression-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toBe("Martwy ciag:1");
    expect(cards[1].textContent).toBe("Przysiad:2");
  });

  it("does not render empty-state text when entries exist", () => {
    setupQuery({ data: [makeEntry()] });
    render(<ProgressionsTab athlete={makeAthlete()} />);
    expect(
      screen.queryByText(pl.coach.athlete.progressions.empty),
    ).not.toBeInTheDocument();
  });

  it("toggles the create form via the add button", () => {
    setupQuery({ data: [] });
    render(<ProgressionsTab athlete={makeAthlete()} />);

    expect(
      screen.queryByTestId("progression-create-form"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(pl.coach.athlete.progressions.addButton));
    expect(screen.getByTestId("progression-create-form")).toBeInTheDocument();
    fireEvent.click(screen.getByText(pl.coach.athlete.progressions.closeCreate));
    expect(
      screen.queryByTestId("progression-create-form"),
    ).not.toBeInTheDocument();
  });

  it("disables the add button while the create form is submitting", () => {
    setupQuery({ data: [] });
    render(<ProgressionsTab athlete={makeAthlete()} />);
    fireEvent.click(screen.getByText(pl.coach.athlete.progressions.addButton));
    fireEvent.click(screen.getByText("mark-submitting"));
    expect(
      screen.getByText(pl.coach.athlete.progressions.closeCreate),
    ).toBeDisabled();
  });
});