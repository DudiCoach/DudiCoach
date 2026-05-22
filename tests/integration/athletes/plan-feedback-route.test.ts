/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const { mockGetUser, mockFrom } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockFrom = vi.fn();
  return { mockGetUser, mockFrom };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

import { GET } from "@/app/api/athletes/[id]/plans/[planId]/feedback/route";

const COACH = { id: "coach-uuid-001", email: "coach@test.com" };
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

function makeAthletesBuilder(result?: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      result ?? {
        data: { id: ATHLETE_ID },
        error: null,
      },
    ),
  };
}

function makeTrainingPlansBuilder(result?: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      result ?? {
        data: { id: PLAN_ID },
        error: null,
      },
    ),
  };
}

function makeFeedbackBuilder(result?: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order
    .mockImplementationOnce(() => builder)
    .mockImplementationOnce(() =>
      Promise.resolve(
        result ?? {
          data: [
            {
              id: "fb-2",
              plan_id: PLAN_ID,
              athlete_id: ATHLETE_ID,
              week_number: 1,
              day_number: 2,
              feedback_text: "Dzien 2",
              created_at: "2026-05-22T12:00:00.000Z",
              updated_at: "2026-05-22T12:00:00.000Z",
            },
            {
              id: "fb-1",
              plan_id: PLAN_ID,
              athlete_id: ATHLETE_ID,
              week_number: 1,
              day_number: 1,
              feedback_text: "Dzien 1",
              created_at: "2026-05-22T11:00:00.000Z",
              updated_at: "2026-05-22T11:00:00.000Z",
            },
          ],
          error: null,
        },
      ),
    );

  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: COACH }, error: null });
});

describe("GET /api/athletes/[id]/plans/[planId]/feedback", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(
      makeRequest() as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 404 for invalid UUID params", async () => {
    const response = await GET(
      makeRequest("not-a-uuid", PLAN_ID) as Parameters<typeof GET>[0],
      routeContext("not-a-uuid", PLAN_ID),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 404 when athlete is not accessible (non-owned/not found)", async () => {
    const athletesBuilder = makeAthletesBuilder({
      data: null,
      error: { code: "PGRST116", message: "No rows found" },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "athletes") return athletesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await GET(
      makeRequest() as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns 404 when plan does not belong to athlete / non-owned", async () => {
    const athletesBuilder = makeAthletesBuilder();
    const trainingPlansBuilder = makeTrainingPlansBuilder({
      data: null,
      error: { code: "PGRST116", message: "No rows found" },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "athletes") return athletesBuilder;
      if (table === "training_plans") return trainingPlansBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await GET(
      makeRequest() as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns sorted feedback rows for owned athlete plan", async () => {
    const athletesBuilder = makeAthletesBuilder();
    const trainingPlansBuilder = makeTrainingPlansBuilder();
    const feedbackBuilder = makeFeedbackBuilder();

    mockFrom.mockImplementation((table: string) => {
      if (table === "athletes") return athletesBuilder;
      if (table === "training_plans") return trainingPlansBuilder;
      if (table === "plan_session_feedback") return feedbackBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await GET(
      makeRequest() as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
    expect(feedbackBuilder.order).toHaveBeenNthCalledWith(1, "week_number", {
      ascending: true,
    });
    expect(feedbackBuilder.order).toHaveBeenNthCalledWith(2, "day_number", {
      ascending: true,
    });
  });
});
