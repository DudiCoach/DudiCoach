/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const { mockGetAthleteByShareCode, mockGetInjuries } = vi.hoisted(() => {
  const mockGetAthleteByShareCode = vi.fn();
  const mockGetInjuries = vi.fn();
  return { mockGetAthleteByShareCode, mockGetInjuries };
});

vi.mock("@/lib/data/athlete", () => ({
  getAthleteByShareCode: mockGetAthleteByShareCode,
}));

vi.mock("@/lib/data/injury", () => ({
  getInjuries: mockGetInjuries,
}));

import { GET } from "@/app/api/athlete/[shareCode]/injuries/route";

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

beforeEach(() => {
  vi.clearAllMocks();
  // Default: valid athlete, no injuries
  mockGetAthleteByShareCode.mockResolvedValue(makeAthlete());
  mockGetInjuries.mockResolvedValue([]);
});

describe("GET /api/athlete/[shareCode]/injuries (public endpoint)", () => {
  it("returns 404 for invalid share code format", async () => {
    const response = await GET(
      new Request("http://localhost/api/athlete/abc/injuries") as Parameters<typeof GET>[0],
      routeContext("abc"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).not.toHaveBeenCalled();
  });

  it("returns 404 for nonexistent share code", async () => {
    mockGetAthleteByShareCode.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/injuries") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).toHaveBeenCalledWith("ABC234");
  });

  it("returns 404 for inactive share code", async () => {
    mockGetAthleteByShareCode.mockResolvedValue(makeAthlete({ share_active: false }));

    const response = await GET(
      new Request("http://localhost/api/athlete/DEF234/injuries") as Parameters<typeof GET>[0],
      routeContext("DEF234"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockGetAthleteByShareCode).toHaveBeenCalledWith("DEF234");
  });

  it("returns 200 with empty data for valid code without injuries", async () => {
    mockGetInjuries.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/injuries") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(mockGetAthleteByShareCode).toHaveBeenCalledWith("ABC234");
    expect(mockGetInjuries).toHaveBeenCalledWith("athlete-uuid-001");
  });

  it("returns only active injuries for public view", async () => {
    mockGetInjuries.mockResolvedValue([
      {
        id: "injury-1",
        athlete_id: "athlete-uuid-001",
        name: "Knee sprain",
        body_location: "Knee",
        severity: 3,
        injury_date: "2024-01-15",
        status: "active",
        notes: null,
        created_at: "2024-01-15T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      },
      {
        id: "injury-2",
        athlete_id: "athlete-uuid-001",
        name: "Old ankle injury",
        body_location: "Ankle",
        severity: 2,
        injury_date: "2023-06-01",
        status: "recovered",
        notes: null,
        created_at: "2023-06-01T00:00:00Z",
        updated_at: "2023-06-01T00:00:00Z",
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/injuries") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("Knee sprain");
    expect(json.data[0].status).toBe("active");
  });

  it("returns 500 when athlete lookup throws an error", async () => {
    mockGetAthleteByShareCode.mockRejectedValue(new Error("Firestore error"));

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/injuries") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });

  it("returns 500 when injuries lookup throws an error", async () => {
    mockGetInjuries.mockRejectedValue(new Error("Firestore error"));

    const response = await GET(
      new Request("http://localhost/api/athlete/ABC234/injuries") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });
});
