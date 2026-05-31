/// <reference types="vitest/globals" />

import { describe, it, expect } from "vitest";
import { render, screen, getAllByText } from "@testing-library/react";

import PlanPrintView from "@/components/coach/PlanPrintView";
import type { TrainingPlan } from "@/lib/api/plans";
import type { Week } from "@/lib/validation/training-plan";

function makeWeek(weekNumber: number): Week {
  return {
    weekNumber,
    focus: `Fokus tygodnia ${weekNumber}`,
    days: [
      {
        dayNumber: 1,
        dayName: "Poniedzialek",
        warmup: "Rozgrzewka",
        exercises: [
          {
            name: "Przysiad",
            sets: "4",
            reps: "8",
            intensity: "75%",
            rest: "120s",
            tempo: "30X0",
            notes: "Technika",
          },
        ],
        cooldown: "Stretching",
        duration: "60 min",
      },
    ],
  };
}

function makePlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: "plan-uuid-001",
    athlete_id: "athlete-uuid-001",
    plan_name: "Program silowy 4-tyg.",
    phase: "bazowy",
    is_active: true,
    plan_json: {
      planName: "Program silowy 4-tyg.",
      phase: "bazowy",
      summary: "Solidna baza",
      weeklyOverview: "4 treningi",
      weeks: [makeWeek(1), makeWeek(2), makeWeek(3), makeWeek(4)],
      progressionNotes: "Zwieksz ciezar",
      nutritionTips: "Bialko",
      recoveryProtocol: "Sypiac",
    },
    created_at: "2026-04-24T10:00:00Z",
    ...overrides,
  };
}

describe("PlanPrintView", () => {
  it("renders plan name", () => {
    render(<PlanPrintView plan={makePlan()} />);
    expect(screen.getByText("Program silowy 4-tyg.")).toBeInTheDocument();
  });

  it("renders all 4 week headers", () => {
    render(<PlanPrintView plan={makePlan()} />);
    expect(screen.getAllByText(/Tydzień 1/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Tydzień 2/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Tydzień 3/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Tydzień 4/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders exercises in table (4 instances, one per week)", () => {
    render(<PlanPrintView plan={makePlan()} />);
    const exercises = screen.getAllByText("Przysiad");
    expect(exercises).toHaveLength(4);
  });

  it("renders summary, progression notes, nutrition, and recovery", () => {
    render(<PlanPrintView plan={makePlan()} />);
    expect(screen.getByText("Solidna baza")).toBeInTheDocument();
    expect(screen.getByText("Zwieksz ciezar")).toBeInTheDocument();
    expect(screen.getByText("Bialko")).toBeInTheDocument();
    expect(screen.getByText("Sypiac")).toBeInTheDocument();
  });

  it("has print-only class", () => {
    const { container } = render(<PlanPrintView plan={makePlan()} />);
    expect(container.firstChild).toHaveClass("plan-print-view");
  });

  it("renders phase", () => {
    render(<PlanPrintView plan={makePlan()} />);
    expect(screen.getByText(/bazowy/)).toBeInTheDocument();
  });

  it("renders day name (4 instances, one per week)", () => {
    render(<PlanPrintView plan={makePlan()} />);
    const days = screen.getAllByText(/Poniedzialek/);
    expect(days).toHaveLength(4);
  });
});
