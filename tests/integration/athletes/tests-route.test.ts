/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const {
  mockRequireAuth,
  mockGetAthleteById,
  mockGetFitnessTestResults,
  mockCreateFitnessTestResult,
} = vi.hoisted(() => {
  const mockRequireAuth = vi.fn();
  const mockGetAthleteById = vi.fn();
  const mockGetFitnessTestResults = vi.fn();
  const mockCreateFitnessTestResult = vi.fn();
  return { mockRequireAuth, mockGetAthleteById, mockGetFitnessTestResults, mockCreateFitnessTestResult };
});

vi.mock("@/lib/api/auth-guard", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/data/athlete", () => ({
  getAthleteById: (...args: unknown[]) => mockGetAthleteById(...args),
}));

vi.mock("@/lib/data/fitness-test", () => ({
  getFitnessTestResults: (...args: unknown[]) => mockGetFitnessTestResults(...args),
  createFitnessTestResult: (...args: unknown[]) => mockCreateFitnessTestResult(...args),
}));

import { GET, POST } from "@/app/api/athletes/[id]/tests/route";

const COACH_USER = { uid: "coach-uuid-001", email: "coach@test.com" };
const ATHLETE_ID = "athlete-uuid-001";

const TEST_RESULT = {
  id: "test-result-uuid-001",
  athlete_id: ATHLETE_ID,
  test_key: "sprint_30m",
  value: 4.35,
  test_date: "2026-04-20",
  notes: "Wynik po rozgrzewce",
  created_at: "2026-04-20T10:00:00Z",
};

function routeContext(id = ATHLETE_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(`http://localhost/api/athletes/${ATHLETE_ID}/tests`, init);
}

function setupAuthenticated() {
  mockRequireAuth.mockResolvedValue({ user: COACH_USER, response: null });
  mockGetAthleteById.mockResolvedValue({ id: ATHLETE_ID, sport: "pilka_nozna" });
}

function setupUnauthenticated() {
  mockRequireAuth.mockResolvedValue({
    user: null,
    response: new Response(JSON.stringify({ error: "Brak autoryzacji." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/athletes/[id]/tests", () => {
  it("returns 401 when unauthenticated", async () => {
    setupUnauthenticated();

    const response = await GET(
      makeRequest("GET") as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockGetAthleteById).not.toHaveBeenCalled();
  });

  it("returns 404 when athlete does not exist", async () => {
    setupAuthenticated();
    mockGetAthleteById.mockResolvedValue(null);

    const response = await GET(
      makeRequest("GET") as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono zawodnika.");
  });

  it("returns 200 + test results when athlete exists", async () => {
    setupAuthenticated();
    mockGetFitnessTestResults.mockResolvedValue([
      { id: TEST_RESULT.id, data: { athleteId: ATHLETE_ID, testKey: TEST_RESULT.test_key, testDate: TEST_RESULT.test_date, value: TEST_RESULT.value, unit: null, notes: TEST_RESULT.notes, createdAt: TEST_RESULT.created_at } },
    ]);

    const response = await GET(
      makeRequest("GET") as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].test_key).toBe("sprint_30m");
  });

  it("propagates error when tests query fails", async () => {
    setupAuthenticated();
    mockGetFitnessTestResults.mockRejectedValue(new Error("Firestore read failed"));

    await expect(
      GET(
        makeRequest("GET") as Parameters<typeof GET>[0],
        routeContext(),
      ),
    ).rejects.toThrow("Firestore read failed");
  });
});

describe("POST /api/athletes/[id]/tests", () => {
  it("returns 401 when unauthenticated", async () => {
    setupUnauthenticated();

    const response = await POST(
      makeRequest("POST", {
        test_key: "sprint_30m",
        value: 4.35,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockGetAthleteById).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid body", async () => {
    setupAuthenticated();

    const response = await POST(
      makeRequest("POST", {
        test_key: "unknown_test",
        value: -10,
        test_date: "20-04-2026",
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("returns 404 when athlete does not exist", async () => {
    setupAuthenticated();
    mockGetAthleteById.mockResolvedValue(null);

    const response = await POST(
      makeRequest("POST", {
        test_key: "sprint_30m",
        value: 4.35,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono zawodnika.");
  });

  it("returns 400 when selected test does not match athlete sport", async () => {
    setupAuthenticated();

    const response = await POST(
      makeRequest("POST", {
        test_key: "swim_50m",
        value: 31.2,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(Array.isArray(json.issues)).toBe(true);
    expect(json.issues[0].path).toEqual(["test_key"]);
  });

  it("returns 201 when test result is created", async () => {
    setupAuthenticated();
    mockCreateFitnessTestResult.mockResolvedValue({
      id: TEST_RESULT.id,
      data: {
        athleteId: ATHLETE_ID,
        testKey: TEST_RESULT.test_key,
        testDate: TEST_RESULT.test_date,
        value: TEST_RESULT.value,
        unit: null,
        notes: TEST_RESULT.notes,
        createdAt: TEST_RESULT.created_at,
      },
    });

    const response = await POST(
      makeRequest("POST", {
        test_key: TEST_RESULT.test_key,
        value: TEST_RESULT.value,
        test_date: TEST_RESULT.test_date,
        notes: TEST_RESULT.notes,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.test_key).toBe("sprint_30m");
  });

  it("propagates error on unexpected write error", async () => {
    setupAuthenticated();
    mockCreateFitnessTestResult.mockRejectedValue(new Error("Firestore write failed"));

    await expect(
      POST(
        makeRequest("POST", {
          test_key: "sprint_30m",
          value: 4.2,
        }) as Parameters<typeof POST>[0],
        routeContext(),
      ),
    ).rejects.toThrow("Firestore write failed");
  });
});
