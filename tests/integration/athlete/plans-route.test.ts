/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const { mockGetAthleteByShareCode, mockGetLatestPlanByShareCode } = vi.hoisted(() => {
  const mockGetAthleteByShareCode = vi.fn();
  const mockGetLatestPlanByShareCode = vi.fn();
  return { mockGetAthleteByShareCode, mockGetLatestPlanByShareCode };
});

vi.mock("@/lib/data/athlete", () => ({
  getAthleteByShareCode: mockGetAthleteByShareCode,
}));

vi.mock("@/lib/data/training-plan", () => ({
  getLatestPlanByShareCode: mockGetLatestPlanByShareCode,
}));

import { GET } from "@/app/api/athlete/[shareCode]/plans/route";

function routeContext(shareCode: string) {
  return { params: Promise.resolve({ shareCode }) };
}

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    plan_name: "Program silowy 4-tyg.",
    phase: "Bazowy",
    plan_json: {
      planName: "Program silowy 4-tyg.",
      phase: "Bazowy",
      summary: "Ogolny plan silowy",
      weeklyOverview: "4 treningi tygodniowo",
      weeks: [],
      progressionNotes: "Zwieszaj ciezar co tydzien",
      nutritionTips: "Jedz duzo bialka",
      recoveryProtocol: "Spij 8 godzin",
    },
    created_at: "2026-04-24T12:00:00.000Z",
    ...overrides,
  };
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

beforeEach(() => {
  vi.clearAllMocks();
  // Default: valid athlete, no plan
  mockGetAthleteByShareCode.mockResolvedValue(makeAthlete());
  mockGetLatestPlanByShareCode.mockResolvedValue(null);
});

describe("GET /api/athlete/[shareCode]/plans (public endpoint)", () => {
  it("returns 404 for invalid share code format (too short)", async () => {
    const response = await GET(
      new Request("http://localhost/api/athlete/abc/plans") as Parameters<typeof GET>[0],
      routeContext("abc"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).not.toHaveBeenCalled();
  });

  it("returns 404 for share code with forbidden characters (contains 0, 1, I)", async () => {
    const response = await GET(
      new Request("http://localhost/api/athlete/ABC01I/plans") as Parameters<typeof GET>[0],
      routeContext("ABC01I"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).not.toHaveBeenCalled();
  });

  it("returns 404 for nonexistent share code", async () => {
    mockGetAthleteByShareCode.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/plans") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).toHaveBeenCalledTimes(1);
    expect(mockGetAthleteByShareCode).toHaveBeenCalledWith("ABC234");
  });

  it("returns 404 for inactive share code", async () => {
    mockGetAthleteByShareCode.mockResolvedValue(makeAthlete({ share_active: false }));

    const response = await GET(
      new Request("http://localhost/api/athlete/DEF234/plans") as Parameters<typeof GET>[0],
      routeContext("DEF234"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).toHaveBeenCalledTimes(1);
    expect(mockGetAthleteByShareCode).toHaveBeenCalledWith("DEF234");
  });

  it("returns 200 with { data: null } when code is valid+active but athlete has no plan", async () => {
    mockGetLatestPlanByShareCode.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/plans") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toBeNull();
    expect(mockGetAthleteByShareCode).toHaveBeenCalledWith("ABC234");
    expect(mockGetLatestPlanByShareCode).toHaveBeenCalledWith("ABC234");
  });

  it("returns 200 with public-safe plan shape and excludes athlete_id/coach_id", async () => {
    const plan = makePlan();
    mockGetLatestPlanByShareCode.mockResolvedValue(plan);

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/plans") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(json.data.plan_name).toBe("Program silowy 4-tyg.");
    expect(json.data.phase).toBe("Bazowy");
    expect(json.data.plan_json).toBeDefined();
    expect(json.data.created_at).toBe("2026-04-24T12:00:00.000Z");
    expect(json.data).not.toHaveProperty("athlete_id");
    expect(json.data).not.toHaveProperty("coach_id");
  });

  it("returns 500 when athlete lookup throws an error", async () => {
    mockGetAthleteByShareCode.mockRejectedValue(new Error("Firestore error"));

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/plans") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });

  it("returns 500 when plan lookup throws an error", async () => {
    mockGetLatestPlanByShareCode.mockRejectedValue(new Error("Firestore error"));

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/plans") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });

  it("normalizes lowercase share code to uppercase before data lookups", async () => {
    const response = await GET(
      new Request("http://localhost/api/athlete/abc234/plans") as Parameters<typeof GET>[0],
      routeContext("abc234"),
    );

    expect(response.status).toBe(200);
    expect(mockGetAthleteByShareCode).toHaveBeenCalledWith("ABC234");
    expect(mockGetLatestPlanByShareCode).toHaveBeenCalledWith("ABC234");
  });
});
