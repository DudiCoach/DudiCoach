/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const { mockGetAthleteByShareCode, mockGetLatestPlanByShareCode, mockUpsertSessionFeedback, mockGetSessionFeedbackByShareCode, mockValidatePlanDay } = vi.hoisted(() => {
  const mockGetAthleteByShareCode = vi.fn();
  const mockGetLatestPlanByShareCode = vi.fn();
  const mockUpsertSessionFeedback = vi.fn();
  const mockGetSessionFeedbackByShareCode = vi.fn();
  const mockValidatePlanDay = vi.fn();
  return { mockGetAthleteByShareCode, mockGetLatestPlanByShareCode, mockUpsertSessionFeedback, mockGetSessionFeedbackByShareCode, mockValidatePlanDay };
});

vi.mock("@/lib/data/athlete", () => ({
  getAthleteByShareCode: mockGetAthleteByShareCode,
}));

vi.mock("@/lib/data/training-plan", () => ({
  getLatestPlanByShareCode: mockGetLatestPlanByShareCode,
}));

vi.mock("@/lib/data/session-feedback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/session-feedback")>();
  return {
    ...actual,
    upsertSessionFeedback: mockUpsertSessionFeedback,
    getSessionFeedbackByShareCode: mockGetSessionFeedbackByShareCode,
    validatePlanDay: mockValidatePlanDay,
  };
});

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/athlete/[shareCode]/feedback/route";

function routeContext(shareCode: string) {
  return { params: Promise.resolve({ shareCode }) };
}

function makeAthlete(overrides: Record<string, unknown> = {}) {
  return {
    id: "athlete-uuid-001",
    coach_id: "coach-uuid-001",
    name: "John Doe",
    share_code: "ABC234",
    share_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-uuid-001",
    plan_name: "Program silowy 4-tyg.",
    phase: "Bazowy",
    plan_json: {
      planName: "Program silowy 4-tyg.",
      phase: "Bazowy",
      summary: "Ogolny plan silowy",
      weeklyOverview: "4 treningi tygodniowo",
      weeks: [
        {
          weekNumber: 1,
          focus: "Faza bazowa",
          days: [
            { dayNumber: 1, dayName: "Poniedzialek" },
            { dayNumber: 2, dayName: "Wtorek" },
          ],
        },
      ],
      progressionNotes: "Zwieszaj ciezar co tydzien",
      nutritionTips: "Jedz duzo bialka",
      recoveryProtocol: "Spij 8 godzin",
    },
    created_at: "2026-04-24T12:00:00.000Z",
    ...overrides,
  };
}

function makeFeedback(overrides: Record<string, unknown> = {}) {
  return {
    id: "feedback-uuid-001",
    athlete_id: "athlete-uuid-001",
    plan_id: "plan-uuid-001",
    week_number: 1,
    day_number: 1,
    feedback_text: "Trening poszedl dobrze",
    created_at: "2026-04-25T10:00:00Z",
    updated_at: "2026-04-25T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: valid athlete, plan, and day
  mockGetAthleteByShareCode.mockResolvedValue(makeAthlete());
  mockGetLatestPlanByShareCode.mockResolvedValue(makePlan());
  mockValidatePlanDay.mockReturnValue(true);
  mockGetSessionFeedbackByShareCode.mockResolvedValue([]);
  mockUpsertSessionFeedback.mockResolvedValue(makeFeedback());
});

describe("GET /api/athlete/[shareCode]/feedback (public endpoint)", () => {
  it("returns 404 for invalid share code format", async () => {
    const request = new NextRequest("http://localhost/api/athlete/abc/feedback?plan_id=plan-uuid-001");
    const response = await GET(request, routeContext("abc"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).not.toHaveBeenCalled();
  });

  it("returns 400 when plan_id is missing", async () => {
    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback");
    const response = await GET(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("plan_id is required");
  });

  it("returns 404 for nonexistent share code", async () => {
    mockGetAthleteByShareCode.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback?plan_id=plan-uuid-001");
    const response = await GET(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns 404 for inactive share code", async () => {
    mockGetAthleteByShareCode.mockResolvedValue(makeAthlete({ share_active: false }));

    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback?plan_id=plan-uuid-001");
    const response = await GET(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns 200 with empty data when no feedback exists", async () => {
    mockGetSessionFeedbackByShareCode.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback?plan_id=plan-uuid-001");
    const response = await GET(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  it("returns 200 with feedback data", async () => {
    const feedback = makeFeedback();
    mockGetSessionFeedbackByShareCode.mockResolvedValue([feedback]);

    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback?plan_id=plan-uuid-001");
    const response = await GET(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].feedback_text).toBe("Trening poszedl dobrze");
  });
});

describe("POST /api/athlete/[shareCode]/feedback (public endpoint)", () => {
  it("returns 404 for invalid share code format", async () => {
    const request = new NextRequest("http://localhost/api/athlete/abc/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: "plan-uuid-001",
        week_number: 1,
        day_number: 1,
        feedback_text: "Test feedback",
      }),
    });
    const response = await POST(request, routeContext("abc"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns 404 for nonexistent share code", async () => {
    mockGetAthleteByShareCode.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: "plan-uuid-001",
        week_number: 1,
        day_number: 1,
        feedback_text: "Test feedback",
      }),
    });
    const response = await POST(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns 404 for inactive share code", async () => {
    mockGetAthleteByShareCode.mockResolvedValue(makeAthlete({ share_active: false }));

    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: "plan-uuid-001",
        week_number: 1,
        day_number: 1,
        feedback_text: "Test feedback",
      }),
    });
    const response = await POST(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns 400 for invalid JSON body", async () => {
    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });
    const response = await POST(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
  });

  it("returns 400 for missing required fields", async () => {
    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for invalid week/day numbers not in plan", async () => {
    // Use valid zod numbers but validatePlanDay returns false
    mockValidatePlanDay.mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: "plan-uuid-001",
        week_number: 1,
        day_number: 3,
        feedback_text: "Test feedback",
      }),
    });
    const response = await POST(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid week or day number for this plan");
  });

  it("returns 201 with feedback data on success", async () => {
    const feedback = makeFeedback();
    mockUpsertSessionFeedback.mockResolvedValue(feedback);

    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: "plan-uuid-001",
        week_number: 1,
        day_number: 1,
        feedback_text: "Trening poszedl dobrze",
      }),
    });
    const response = await POST(request, routeContext("ABC234"));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data).toBeDefined();
    expect(json.data.feedback_text).toBe("Trening poszedl dobrze");
    expect(mockUpsertSessionFeedback).toHaveBeenCalledWith(
      "athlete-uuid-001",
      "plan-uuid-001",
      1,
      1,
      "Trening poszedl dobrze",
    );
  });

  it("trims feedback text via zod validation", async () => {
    const feedback = makeFeedback({ feedback_text: "Test feedback" });
    mockUpsertSessionFeedback.mockResolvedValue(feedback);

    const request = new NextRequest("http://localhost/api/athlete/ABC234/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: "plan-uuid-001",
        week_number: 1,
        day_number: 1,
        feedback_text: "  Test feedback  ",
      }),
    });
    const response = await POST(request, routeContext("ABC234"));

    expect(response.status).toBe(201);
    // Zod .trim() strips whitespace before passing to upsert
    expect(mockUpsertSessionFeedback).toHaveBeenCalledWith(
      "athlete-uuid-001",
      "plan-uuid-001",
      1,
      1,
      "Test feedback",
    );
  });
});
