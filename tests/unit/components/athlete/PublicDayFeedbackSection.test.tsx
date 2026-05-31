/// <reference types="vitest/globals" />

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pl } from "@/lib/i18n/pl";
import PublicDayFeedbackSection from "@/components/athlete/PublicDayFeedbackSection";
import {
  PlanFeedbackRequestError,
  type PlanSessionFeedbackRow,
} from "@/lib/api/plan-feedback";

const mockFetchPublicDayFeedback = vi.fn();
const mockUpsertPublicDayFeedback = vi.fn();

vi.mock("@/lib/api/plan-feedback", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/plan-feedback")>(
    "@/lib/api/plan-feedback",
  );
  return {
    ...actual,
    fetchPublicDayFeedback: (...args: unknown[]) =>
      mockFetchPublicDayFeedback(...(args as [])),
    upsertPublicDayFeedback: (...args: unknown[]) =>
      mockUpsertPublicDayFeedback(...(args as [])),
  };
});

function makeRow(overrides: Partial<PlanSessionFeedbackRow> = {}): PlanSessionFeedbackRow {
  return {
    id: "feedback-1",
    plan_id: "plan-1",
    athlete_id: "athlete-1",
    week_number: 1,
    day_number: 1,
    feedback_text: "Solid session",
    created_at: "2026-05-27T10:00:00Z",
    updated_at: "2026-05-27T10:00:00Z",
    ...overrides,
  };
}

function setup() {
  return render(
    <PublicDayFeedbackSection
      shareCode="ABC234"
      planId="plan-1"
      weekNumber={1}
      dayNumber={1}
    />,
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolveFn) => {
    resolve = resolveFn;
  });
  return { promise, resolve };
}

describe("PublicDayFeedbackSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPublicDayFeedback.mockResolvedValue(null);
    mockUpsertPublicDayFeedback.mockResolvedValue(makeRow());
  });

  it("loads existing feedback and prefills textarea", async () => {
    mockFetchPublicDayFeedback.mockResolvedValueOnce(
      makeRow({ feedback_text: "Already saved" }),
    );

    setup();

    const textarea = await screen.findByLabelText(/Twoja informacja zwrotna/i);
    await waitFor(() => {
      expect(textarea).toHaveValue("Already saved");
    });
  });

  it("submits valid feedback and shows saved state", async () => {
    setup();

    const textarea = await screen.findByLabelText(/Twoja informacja zwrotna/i);
    fireEvent.change(textarea, { target: { value: "  New feedback  " } });
    fireEvent.click(screen.getByRole("button", { name: pl.athletePanel.plan.feedback.save }));

    await waitFor(() => {
      expect(mockUpsertPublicDayFeedback).toHaveBeenCalledWith({
        shareCode: "ABC234",
        planId: "plan-1",
        weekNumber: 1,
        dayNumber: 1,
        feedbackText: "New feedback",
      });
      expect(screen.getByRole("status")).toHaveTextContent(
        pl.athletePanel.plan.feedback.saved,
      );
    });
  });

  it("supports second submit/update for the same day", async () => {
    mockFetchPublicDayFeedback.mockResolvedValueOnce(
      makeRow({ feedback_text: "First" }),
    );
    mockUpsertPublicDayFeedback
      .mockResolvedValueOnce(makeRow({ feedback_text: "Second" }))
      .mockResolvedValueOnce(makeRow({ feedback_text: "Third" }));

    setup();

    const textarea = await screen.findByLabelText(/Twoja informacja zwrotna/i);
    fireEvent.change(textarea, { target: { value: "Second" } });
    fireEvent.click(screen.getByRole("button", { name: pl.athletePanel.plan.feedback.save }));

    await waitFor(() => {
      expect(textarea).toHaveValue("Second");
    });

    fireEvent.change(textarea, { target: { value: "Third" } });
    fireEvent.click(screen.getByRole("button", { name: pl.athletePanel.plan.feedback.save }));

    await waitFor(() => {
      expect(textarea).toHaveValue("Third");
      expect(mockUpsertPublicDayFeedback).toHaveBeenCalledTimes(2);
    });
  });

  it("rejects whitespace-only feedback locally", async () => {
    setup();

    const textarea = await screen.findByLabelText(/Twoja informacja zwrotna/i);
    fireEvent.change(textarea, { target: { value: "   \n\t" } });
    fireEvent.click(screen.getByRole("button", { name: pl.athletePanel.plan.feedback.save }));

    expect(mockUpsertPublicDayFeedback).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      pl.athletePanel.plan.feedback.emptyError,
    );
  });

  it("rejects text longer than 2000 characters locally", async () => {
    setup();

    const textarea = await screen.findByLabelText(/Twoja informacja zwrotna/i);
    fireEvent.change(textarea, { target: { value: "a".repeat(2001) } });
    fireEvent.click(screen.getByRole("button", { name: pl.athletePanel.plan.feedback.save }));

    expect(mockUpsertPublicDayFeedback).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      pl.athletePanel.plan.feedback.maxLengthError,
    );
  });

  it("shows generic save error on failed request", async () => {
    mockUpsertPublicDayFeedback.mockRejectedValueOnce(new PlanFeedbackRequestError());

    setup();

    const textarea = await screen.findByLabelText(/Twoja informacja zwrotna/i);
    fireEvent.change(textarea, { target: { value: "Feedback" } });
    fireEvent.click(screen.getByRole("button", { name: pl.athletePanel.plan.feedback.save }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        pl.athletePanel.plan.feedback.saveError,
      );
    });
  });

  it("does not log feedback text to console", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    setup();

    const textarea = await screen.findByLabelText(/Twoja informacja zwrotna/i);
    fireEvent.change(textarea, { target: { value: "Sensitive feedback" } });
    fireEvent.click(screen.getByRole("button", { name: pl.athletePanel.plan.feedback.save }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        pl.athletePanel.plan.feedback.saved,
      );
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("has accessible textarea label", async () => {
    setup();

    expect(await screen.findByLabelText(/Tydzien 1, Dzien 1/)).toBeInTheDocument();
  });

  it("disables save button while saving", async () => {
    const deferred = createDeferred<PlanSessionFeedbackRow>();
    mockUpsertPublicDayFeedback.mockReturnValueOnce(deferred.promise);

    setup();

    const textarea = await screen.findByLabelText(/Twoja informacja zwrotna/i);
    const button = screen.getByRole("button", { name: pl.athletePanel.plan.feedback.save });
    const form = button.closest("form");

    fireEvent.change(textarea, { target: { value: "Saving now" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(form).toHaveAttribute("aria-busy", "true");
    });

    deferred.resolve(makeRow({ feedback_text: "Saving now" }));

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});
