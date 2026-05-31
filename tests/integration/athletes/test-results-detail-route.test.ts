/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const { mockRequireAuth, mockDeleteFitnessTestResult } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn();
  const mockDeleteFitnessTestResult = vi.fn();
  return { mockRequireAuth, mockDeleteFitnessTestResult };
});

vi.mock("@/lib/api/auth-guard", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/data/fitness-test", () => ({
  deleteFitnessTestResult: (...args: unknown[]) => mockDeleteFitnessTestResult(...args),
}));

import { DELETE } from "@/app/api/athletes/[id]/tests/[testId]/route";

const COACH_USER = { uid: "coach-uuid-001", email: "coach@test.com" };
const ATHLETE_ID = "athlete-uuid-001";
const TEST_RESULT_ID = "test-result-uuid-001";

function routeContext(id = ATHLETE_ID, testId = TEST_RESULT_ID) {
  return { params: Promise.resolve({ id, testId }) };
}

function makeRequest(method: string): Request {
  return new Request(
    `http://localhost/api/athletes/${ATHLETE_ID}/tests/${TEST_RESULT_ID}`,
    { method },
  );
}

function setupAuthenticated() {
  mockRequireAuth.mockResolvedValue({ user: COACH_USER, response: null });
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

describe("DELETE /api/athletes/[id]/tests/[testId]", () => {
  it("returns 401 when unauthenticated", async () => {
    setupUnauthenticated();

    const response = await DELETE(
      makeRequest("DELETE") as Parameters<typeof DELETE>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockDeleteFitnessTestResult).not.toHaveBeenCalled();
  });

  it("returns 404 when no rows were deleted", async () => {
    setupAuthenticated();
    mockDeleteFitnessTestResult.mockResolvedValue(false);

    const response = await DELETE(
      makeRequest("DELETE") as Parameters<typeof DELETE>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono wyniku testu.");
  });

  it("propagates error on delete failure", async () => {
    setupAuthenticated();
    mockDeleteFitnessTestResult.mockRejectedValue(new Error("Firestore delete failed"));

    await expect(
      DELETE(
        makeRequest("DELETE") as Parameters<typeof DELETE>[0],
        routeContext(),
      ),
    ).rejects.toThrow("Firestore delete failed");
  });

  it("returns 204 when test result is deleted", async () => {
    setupAuthenticated();
    mockDeleteFitnessTestResult.mockResolvedValue(true);

    const response = await DELETE(
      makeRequest("DELETE") as Parameters<typeof DELETE>[0],
      routeContext(),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});
