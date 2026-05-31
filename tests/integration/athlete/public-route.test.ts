/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const { mockGetAthleteByShareCode } = vi.hoisted(() => {
  const mockGetAthleteByShareCode = vi.fn();
  return { mockGetAthleteByShareCode };
});

vi.mock("@/lib/data/athlete", () => ({
  getAthleteByShareCode: mockGetAthleteByShareCode,
}));

import { GET } from "@/app/api/athlete/[shareCode]/route";

function routeContext(shareCode: string) {
  return { params: Promise.resolve({ shareCode }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/athlete/[shareCode] (public endpoint)", () => {
  it("invalid share code format -> 404 (never 401)", async () => {
    const response = await GET(
      new Request("http://localhost/api/athlete/abc") as Parameters<typeof GET>[0],
      routeContext("abc"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).not.toHaveBeenCalled();
  });

  it("valid format but no matching athlete -> 404 (never 401)", async () => {
    mockGetAthleteByShareCode.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).toHaveBeenCalledWith("ABC234");
  });

  // Test 8 — Page-level guard: inactive share code is rejected by the share_active check.
  // When the athlete lookup returns an inactive athlete the route returns 404, preventing any plan
  // data from being served regardless of whether plans exist for that athlete.
  it("inactive share code (athlete share_active=false) -> 404, plan data never served", async () => {
    mockGetAthleteByShareCode.mockResolvedValue({
      id: "athlete-123",
      share_active: false,
      name: "Test Athlete",
    });

    const response = await GET(
      new Request("http://localhost/api/athlete/DEF234") as Parameters<typeof GET>[0],
      routeContext("DEF234"),
    );
    const json = await response.json();

    // Gate must return 404, never expose plan data
    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    // Athlete lookup called exactly once
    expect(mockGetAthleteByShareCode).toHaveBeenCalledTimes(1);
    expect(mockGetAthleteByShareCode).toHaveBeenCalledWith("DEF234");
  });

  it("valid share code with active athlete -> 200 with sanitized data", async () => {
    mockGetAthleteByShareCode.mockResolvedValue({
      id: "athlete-123",
      coach_id: "coach-456",
      name: "John Doe",
      age: 25,
      share_code: "ABC234",
      share_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toBeDefined();
    expect(json.data.name).toBe("John Doe");
    expect(json.data.coach_id).toBeUndefined();
    expect(json.data.share_code).toBe("ABC234");
  });
});
