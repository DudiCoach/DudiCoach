/// <reference types="vitest/globals" />

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PlanFeedbackNotFoundError,
  PlanFeedbackRequestError,
  PlanFeedbackValidationError,
  fetchCoachPlanFeedback,
  fetchPublicDayFeedback,
  upsertPublicDayFeedback,
} from "@/lib/api/plan-feedback";

type JsonInit = Record<string, unknown>;

function mockJsonResponse(status: number, body: JsonInit) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("lib/api/plan-feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns row for public GET 200 response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(200, {
        data: {
          id: "feedback-1",
          plan_id: "plan-1",
          athlete_id: "athlete-1",
          week_number: 1,
          day_number: 2,
          feedback_text: "ok",
          created_at: "2026-05-27T10:00:00Z",
          updated_at: "2026-05-27T10:00:00Z",
        },
      }),
    );

    const result = await fetchPublicDayFeedback({
      shareCode: "ABC234",
      planId: "plan-1",
      weekNumber: 1,
      dayNumber: 2,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/athlete/ABC234/plans/plan-1/feedback?weekNumber=1&dayNumber=2",
    );
    expect(result?.id).toBe("feedback-1");
  });

  it("returns null for public GET 200 with null payload", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { data: null }));

    const result = await fetchPublicDayFeedback({
      shareCode: "ABC234",
      planId: "plan-1",
      weekNumber: 1,
      dayNumber: 2,
    });

    expect(result).toBeNull();
  });

  it("returns row for public POST 200 response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(200, {
        data: {
          id: "feedback-1",
          plan_id: "plan-1",
          athlete_id: "athlete-1",
          week_number: 1,
          day_number: 2,
          feedback_text: "saved",
          created_at: "2026-05-27T10:00:00Z",
          updated_at: "2026-05-27T10:00:00Z",
        },
      }),
    );

    const result = await upsertPublicDayFeedback({
      shareCode: "ABC234",
      planId: "plan-1",
      weekNumber: 1,
      dayNumber: 2,
      feedbackText: "saved",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/athlete/ABC234/plans/plan-1/feedback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: 1,
          dayNumber: 2,
          feedbackText: "saved",
        }),
      },
    );
    expect(result.feedback_text).toBe("saved");
  });

  it("maps 400 responses to validation error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockJsonResponse(400, { error: "Validation failed" }));

    await expect(
      upsertPublicDayFeedback({
        shareCode: "ABC234",
        planId: "plan-1",
        weekNumber: 1,
        dayNumber: 2,
        feedbackText: "x",
      }),
    ).rejects.toBeInstanceOf(PlanFeedbackValidationError);
  });

  it("maps 404 responses to not found error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockJsonResponse(404, { error: "Not found" }));

    await expect(
      fetchPublicDayFeedback({
        shareCode: "ABC234",
        planId: "plan-1",
        weekNumber: 1,
        dayNumber: 2,
      }),
    ).rejects.toBeInstanceOf(PlanFeedbackNotFoundError);
  });

  it("maps 500 responses to generic request error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockJsonResponse(500, { error: "Internal" }));

    await expect(
      fetchCoachPlanFeedback({ athleteId: "athlete-1", planId: "plan-1" }),
    ).rejects.toBeInstanceOf(PlanFeedbackRequestError);
  });

  it("does not log feedback text or share code", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { data: null }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await fetchPublicDayFeedback({
      shareCode: "ABC234",
      planId: "plan-1",
      weekNumber: 1,
      dayNumber: 2,
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
