/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CoachDayFeedbackDisplay from "@/components/coach/CoachDayFeedbackDisplay";
import type { PlanSessionFeedbackRow } from "@/lib/api/plan-feedback";

function makeRow(overrides: Partial<PlanSessionFeedbackRow> = {}): PlanSessionFeedbackRow {
  return {
    id: "feedback-1",
    plan_id: "plan-1",
    athlete_id: "athlete-1",
    week_number: 2,
    day_number: 3,
    feedback_text: "Line 1\nLine 2",
    created_at: "2026-05-27T10:00:00Z",
    updated_at: "2026-05-27T11:00:00Z",
    ...overrides,
  };
}

describe("CoachDayFeedbackDisplay", () => {
  it("renders feedback text when row is present", () => {
    render(<CoachDayFeedbackDisplay feedback={makeRow()} />);

    expect(
      screen.getByText(
        (content) => content.includes("Line 1") && content.includes("Line 2"),
      ),
    ).toBeInTheDocument();
  });

  it("renders script tags as escaped text, not HTML", () => {
    const payload = "<script>alert('xss')</script>";
    const { container } = render(
      <CoachDayFeedbackDisplay feedback={makeRow({ feedback_text: payload })} />,
    );

    expect(screen.getByText(payload)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("preserves line breaks with safe styling", () => {
    render(
      <CoachDayFeedbackDisplay feedback={makeRow({ feedback_text: "a\nb" })} />,
    );

    const textNode = screen.getByText("a b");
    expect(textNode).toHaveClass("whitespace-pre-wrap");
  });

  it("renders updated timestamp", () => {
    render(<CoachDayFeedbackDisplay feedback={makeRow()} />);

    expect(screen.getByText(/Zaktualizowano/i)).toBeInTheDocument();
  });

  it("renders nothing when no feedback row exists", () => {
    const { container } = render(<CoachDayFeedbackDisplay feedback={null} />);
    expect(container.firstChild).toBeNull();
  });
});
