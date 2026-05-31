/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const {
  mockRequireAuth,
  mockGetAthleteById,
  mockGetTrainingPlans,
  mockGetDb,
} = vi.hoisted(() => {
  const mockRequireAuth = vi.fn();
  const mockGetAthleteById = vi.fn();
  const mockGetTrainingPlans = vi.fn();
  const mockGetDb = vi.fn();
  return { mockRequireAuth, mockGetAthleteById, mockGetTrainingPlans, mockGetDb };
});

vi.mock("@/lib/api/auth-guard", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/data/athlete", () => ({
  getAthleteById: (...args: unknown[]) => mockGetAthleteById(...args),
}));

vi.mock("@/lib/data/training-plan", () => ({
  getTrainingPlans: (...args: unknown[]) => mockGetTrainingPlans(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

import { GET } from "@/app/api/athletes/[id]/plans/[planId]/feedback/route";

const COACH = { uid: "coach-uuid-001", email: "coach@test.com" };
const ATHLETE_ID = "550e8400-e29b-41d4-a716-446655440111";
const PLAN_ID = "550e8400-e29b-41d4-a716-446655440000";

function routeContext(id = ATHLETE_ID, planId = PLAN_ID) {
  return { params: Promise.resolve({ id, planId }) };
}

function makeRequest(id = ATHLETE_ID, planId = PLAN_ID) {
  return new Request(
    `http://localhost/api/athletes/${id}/plans/${planId}/feedback`,
    {
      method: "GET",
    },
  );
}

function makeFirestoreFeedbackChain(feedbackData: { id: string; [key: string]: unknown }[]) {
  const chain = {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      docs: feedbackData.map((d) => ({
        id: d.id,
        data: () => {
          const copy = { ...d };
          delete copy.id;
          return copy;
        },
      })),
    }),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: COACH, response: null });
  mockGetAthleteById.mockResolvedValue({ id: ATHLETE_ID });
  mockGetTrainingPlans.mockResolvedValue([{ id: PLAN_ID, athlete_id: ATHLETE_ID }]);
  mockGetDb.mockReturnValue(makeFirestoreFeedbackChain([]));
});

describe("GET /api/athletes/[id]/plans/[planId]/feedback", () => {
  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "Brak autoryzacji." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const response = await GET(
      makeRequest() as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockGetAthleteById).not.toHaveBeenCalled();
  });

  it("returns 404 when athlete is not accessible (non-owned/not found)", async () => {
    mockGetAthleteById.mockResolvedValue(null);

    const response = await GET(
      makeRequest() as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns 404 when plan does not belong to athlete / non-owned", async () => {
    mockGetTrainingPlans.mockResolvedValue([]);

    const response = await GET(
      makeRequest() as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns sorted feedback rows for owned athlete plan", async () => {
    const feedbackRows = [
      {
        id: "fb-2",
        planId: PLAN_ID,
        athleteId: ATHLETE_ID,
        weekNumber: 1,
        dayNumber: 2,
        feedbackText: "Dzien 2",
        createdAt: "2026-05-22T12:00:00.000Z",
        updatedAt: "2026-05-22T12:00:00.000Z",
      },
      {
        id: "fb-1",
        planId: PLAN_ID,
        athleteId: ATHLETE_ID,
        weekNumber: 1,
        dayNumber: 1,
        feedbackText: "Dzien 1",
        createdAt: "2026-05-22T11:00:00.000Z",
        updatedAt: "2026-05-22T11:00:00.000Z",
      },
    ];

    mockGetDb.mockReturnValue(makeFirestoreFeedbackChain(feedbackRows));

    const response = await GET(
      makeRequest() as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(2);
  });
});
