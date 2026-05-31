/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const { mockRequireAuth, mockGetAthleteById, mockUpdateAthlete } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn();
  const mockGetAthleteById = vi.fn();
  const mockUpdateAthlete = vi.fn();
  return { mockRequireAuth, mockGetAthleteById, mockUpdateAthlete };
});

vi.mock("@/lib/api/auth-guard", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/data/athlete", () => ({
  getAthleteById: (...args: unknown[]) => mockGetAthleteById(...args),
  updateAthlete: (...args: unknown[]) => mockUpdateAthlete(...args),
}));

import { POST } from "@/app/api/athletes/[id]/share/route";

const COACH_USER = { uid: "coach-uuid-001", email: "coach@test.com" };

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/athletes/athlete-1/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: COACH_USER, response: null });
  mockGetAthleteById.mockResolvedValue({ id: "athlete-1", share_code: "ABC123", share_active: false });
  mockUpdateAthlete.mockResolvedValue(undefined);
});

describe("POST /api/athletes/[id]/share (activate/deactivate)", () => {
  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "Brak autoryzacji." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const response = await POST(
      makeRequest({ action: "activate" }) as Parameters<typeof POST>[0],
      routeContext("athlete-1"),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockGetAthleteById).not.toHaveBeenCalled();
  });

  it("returns 404 when athlete not found", async () => {
    mockGetAthleteById.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ action: "activate" }) as Parameters<typeof POST>[0],
      routeContext("athlete-1"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("activates sharing", async () => {
    const response = await POST(
      makeRequest({ action: "activate" }) as Parameters<typeof POST>[0],
      routeContext("athlete-1"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.share_active).toBe(true);
    expect(mockUpdateAthlete).toHaveBeenCalledWith("athlete-1", { share_active: true });
  });

  it("deactivates sharing", async () => {
    mockGetAthleteById.mockResolvedValue({ id: "athlete-1", share_code: "ABC123", share_active: true });

    const response = await POST(
      makeRequest({ action: "deactivate" }) as Parameters<typeof POST>[0],
      routeContext("athlete-1"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.share_active).toBe(false);
    expect(mockUpdateAthlete).toHaveBeenCalledWith("athlete-1", { share_active: false });
  });
});
