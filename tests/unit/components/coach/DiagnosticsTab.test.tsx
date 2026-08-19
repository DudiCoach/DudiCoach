/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { pl } from "@/lib/i18n/pl";
import DiagnosticsTab from "@/components/coach/DiagnosticsTab";
import type { Athlete } from "@/lib/api/athletes";
import type { DiagnosticFinding } from "@/lib/api/diagnostics";

const mockUseDiagnostics = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@/lib/hooks/use-diagnostics", () => ({
  useDiagnostics: (...args: unknown[]) => mockUseDiagnostics(...(args as [])),
}));

vi.mock("@/components/coach/DiagnosticCard", () => ({
  default: ({ finding }: { finding: DiagnosticFinding }) => (
    <div data-testid="diagnostic-card">{finding.muscle_key}</div>
  ),
}));

vi.mock("@/components/coach/DiagnosticCreateForm", () => ({
  default: ({
    onSubmittingChange,
  }: {
    onSubmittingChange?: (isSubmitting: boolean) => void;
  }) => (
    <div data-testid="diagnostic-create-form">
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

function makeFinding(overrides: Partial<DiagnosticFinding> = {}): DiagnosticFinding {
  return {
    id: "finding-uuid-001",
    athlete_id: "athlete-uuid-001",
    muscle_key: "anterior_deltoid",
    side: "left",
    severity: "weak",
    notes: null,
    observed_at: "2026-08-19",
    created_at: "2026-08-19T12:00:00Z",
    updated_at: "2026-08-19T12:00:00Z",
    ...overrides,
  };
}

function setupQuery(overrides: Partial<ReturnType<typeof mockUseDiagnostics>> = {}) {
  mockUseDiagnostics.mockReturnValue({
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

describe("DiagnosticsTab", () => {
  it("shows the loading state while the first fetch is in flight", () => {
    setupQuery({ data: [], isLoading: true });
    render(<DiagnosticsTab athlete={makeAthlete()} />);
    expect(
      screen.getByText(pl.coach.athlete.diagnostics.loading),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no findings", () => {
    setupQuery({ data: [] });
    render(<DiagnosticsTab athlete={makeAthlete()} />);
    expect(
      screen.getByText(pl.coach.athlete.diagnostics.empty),
    ).toBeInTheDocument();
  });

  it("shows an error with a retry button when the query fails", () => {
    setupQuery({ data: [], error: new Error("boom") });
    render(<DiagnosticsTab athlete={makeAthlete()} />);
    expect(
      screen.getByRole("alert").textContent,
    ).toContain(pl.coach.athlete.diagnostics.errorGeneric);
    fireEvent.click(screen.getByText(pl.common.tryAgain));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("groups findings by muscle region", () => {
    setupQuery({
      data: [
        makeFinding({ id: "f1", muscle_key: "anterior_deltoid" }),
        makeFinding({ id: "f2", muscle_key: "gastrocnemius" }),
      ],
    });
    render(<DiagnosticsTab athlete={makeAthlete()} />);

    expect(screen.getByText(pl.coach.athlete.diagnostics.region.upper)).toBeInTheDocument();
    expect(screen.getByText(pl.coach.athlete.diagnostics.region.lower)).toBeInTheDocument();
    expect(
      screen.queryByText(pl.coach.athlete.diagnostics.region.foot),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId("diagnostic-card")).toHaveLength(2);
  });

  it("orders findings within a region by severity (dysfunction first) then date", () => {
    setupQuery({
      data: [
        makeFinding({
          id: "f1",
          muscle_key: "anterior_deltoid",
          severity: "weak",
          observed_at: "2026-08-19",
        }),
        makeFinding({
          id: "f2",
          muscle_key: "supraspinatus",
          severity: "dysfunction",
          observed_at: "2026-08-18",
        }),
        makeFinding({
          id: "f3",
          muscle_key: "trapezius_upper",
          severity: "weak",
          observed_at: "2026-08-20",
        }),
      ],
    });
    render(<DiagnosticsTab athlete={makeAthlete()} />);

    const cards = screen.getAllByTestId("diagnostic-card");
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toBe("supraspinatus");
    expect(cards[1].textContent).toBe("trapezius_upper");
    expect(cards[2].textContent).toBe("anterior_deltoid");
  });

  it("toggles the create form via the add button", () => {
    setupQuery({ data: [] });
    render(<DiagnosticsTab athlete={makeAthlete()} />);

    expect(screen.queryByTestId("diagnostic-create-form")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(pl.coach.athlete.diagnostics.addButton));
    expect(screen.getByTestId("diagnostic-create-form")).toBeInTheDocument();
    fireEvent.click(screen.getByText(pl.coach.athlete.diagnostics.closeCreate));
    expect(screen.queryByTestId("diagnostic-create-form")).not.toBeInTheDocument();
  });

  it("disables the add button while the create form is submitting", () => {
    setupQuery({ data: [] });
    render(<DiagnosticsTab athlete={makeAthlete()} />);
    fireEvent.click(screen.getByText(pl.coach.athlete.diagnostics.addButton));
    fireEvent.click(screen.getByText("mark-submitting"));
    expect(screen.getByText(pl.coach.athlete.diagnostics.closeCreate)).toBeDisabled();
  });
});
