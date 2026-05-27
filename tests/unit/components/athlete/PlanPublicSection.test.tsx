/// <reference types="vitest/globals" />

import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { pl } from "@/lib/i18n/pl";
import PlanPublicSection from "@/components/athlete/PlanPublicSection";
import type { PublicTrainingPlan } from "@/lib/types/plan-public";
import type { Day, Week } from "@/lib/validation/training-plan";

vi.mock("@/components/coach/PlanHeader", () => ({
  default: ({ plan }: { plan: { plan_name: string } }) => (
    <div data-testid="plan-header">{plan.plan_name}</div>
  ),
}));

vi.mock("@/components/coach/WeekNavigation", () => ({
  default: ({
    activeWeek,
    onWeekChange,
  }: {
    activeWeek: number;
    onWeekChange: (n: number) => void;
  }) => (
    <div data-testid="week-navigation">
      <button
        type="button"
        onClick={() => onWeekChange(activeWeek === 1 ? 2 : 1)}
      >
        next-week
      </button>
      <span>{`active-${activeWeek}`}</span>
    </div>
  ),
}));

vi.mock("@/components/coach/WeekView", () => ({
  default: ({
    week,
    renderDayFooter,
  }: {
    week: Week;
    renderDayFooter?: (day: Day) => ReactNode;
  }) => (
    <div data-testid="week-view">
      <div>{`Week ${week.weekNumber}`}</div>
      {week.days.map((day) => (
        <div key={day.dayNumber} data-testid={`day-${day.dayNumber}`}>
          {renderDayFooter?.(day) ?? null}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/coach/PlanFooter", () => ({
  default: () => <div data-testid="plan-footer" />,
}));

vi.mock("@/components/athlete/PublicDayFeedbackSection", () => ({
  default: ({
    weekNumber,
    dayNumber,
  }: {
    weekNumber: number;
    dayNumber: number;
  }) => <div>{`feedback-${weekNumber}-${dayNumber}`}</div>,
}));

function makeWeek(weekNumber: number): Week {
  return {
    weekNumber,
    focus: `Focus ${weekNumber}`,
    days: [
      {
        dayNumber: 1,
        dayName: "Day 1",
        warmup: "Warmup",
        exercises: [
          {
            name: "Squat",
            sets: "4",
            reps: "8",
            intensity: "75%",
            rest: "120s",
            tempo: "30X0",
            notes: "",
          },
        ],
        cooldown: "Cooldown",
        duration: "60 min",
      },
    ],
  };
}

function makePlan(overrides: Partial<PublicTrainingPlan> = {}): PublicTrainingPlan {
  return {
    id: "plan-uuid-001",
    plan_name: "Plan test",
    phase: "base",
    plan_json: {
      planName: "Plan test",
      phase: "base",
      summary: "Summary",
      weeklyOverview: "Weekly overview",
      weeks: [makeWeek(1), makeWeek(2), makeWeek(3), makeWeek(4)],
      progressionNotes: "Progress",
      nutritionTips: "Nutrition",
      recoveryProtocol: "Recovery",
    },
    created_at: "2026-04-24T10:00:00Z",
    ...overrides,
  };
}

describe("PlanPublicSection", () => {
  it("renders empty state when plan is null", () => {
    render(<PlanPublicSection plan={null} shareCode="ABC234" />);

    expect(screen.getByText(pl.athletePanel.plan.sectionTitle)).toBeInTheDocument();
    expect(screen.getByText(pl.athletePanel.plan.empty)).toBeInTheDocument();
    expect(screen.queryByTestId("plan-header")).not.toBeInTheDocument();
  });

  it("renders non-empty state for plan", () => {
    render(<PlanPublicSection plan={makePlan()} shareCode="ABC234" />);

    expect(screen.getByTestId("plan-header")).toBeInTheDocument();
    expect(screen.getByTestId("week-navigation")).toBeInTheDocument();
    expect(screen.getByTestId("week-view")).toBeInTheDocument();
    expect(screen.getByTestId("plan-footer")).toBeInTheDocument();
    expect(screen.queryByText(pl.athletePanel.plan.empty)).not.toBeInTheDocument();
  });

  it("renders feedback footer for visible day/session", () => {
    render(<PlanPublicSection plan={makePlan()} shareCode="ABC234" />);

    expect(screen.getByText("feedback-1-1")).toBeInTheDocument();
  });

  it("keeps weekly navigation working", () => {
    render(<PlanPublicSection plan={makePlan()} shareCode="ABC234" />);

    expect(screen.getByText("Week 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "next-week" }));
    expect(screen.getByText("Week 2")).toBeInTheDocument();
    expect(screen.getByText("feedback-2-1")).toBeInTheDocument();
  });
});
