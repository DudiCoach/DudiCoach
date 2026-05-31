/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the data layer AND auth guard
// ---------------------------------------------------------------------------

const mockDataAthlete = vi.hoisted(() => ({
  getAthleteById: vi.fn(),
}));

const mockDataInjury = vi.hoisted(() => ({
  updateInjury: vi.fn(),
  deleteInjury: vi.fn(),
}));

vi.mock("@/lib/data/athlete", () => mockDataAthlete);
vi.mock("@/lib/data/injury", () => mockDataInjury);

const { mockRequireAuth } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn();
  return { mockRequireAuth };
});

vi.mock("@/lib/api/auth-guard", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

import { PATCH, DELETE } from "@/app/api/athletes/[id]/injuries/[injuryId]/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COACH_USER = { uid: "coach-uuid-001", email: "coach@test.com" };
const ATHLETE_ID = "athlete-uuid-001";
const INJURY_ID = "injury-uuid-001";
const ATHLETE = { id: ATHLETE_ID, name: "Jan Kowalski" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, method: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

function routeContext(id: string, injuryId: string) {
  return { params: Promise.resolve({ id, injuryId }) };
}

function setupAuthenticated() {
  mockRequireAuth.mockResolvedValue({ user: COACH_USER, response: null });
}


beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// PATCH /api/athletes/[id]/injuries/[injuryId]
// ============================================================

describe("PATCH /api/athletes/[id]/injuries/[injuryId]", () => {
  it("returns 200 with updated injury", async () => {
    setupAuthenticated();
    mockDataAthlete.getAthleteById.mockResolvedValue(ATHLETE);
    mockDataInjury.updateInjury.mockResolvedValue(undefined);

    const req = makeRequest(
      `http://localhost/api/athletes/${ATHLETE_ID}/injuries/${INJURY_ID}`,
      "PATCH",
      { severity: 4 },
    );
    const response = await PATCH(
      req as Parameters<typeof PATCH>[0],
      routeContext(ATHLETE_ID, INJURY_ID),
    );
    await response.json();

    expect(response.status).toBe(200);
    expect(mockDataInjury.updateInjury).toHaveBeenCalled();
  });

  it("returns 404 when athlete not found", async () => {
    setupAuthenticated();
    mockDataAthlete.getAthleteById.mockResolvedValue(null);

    const req = makeRequest(
      `http://localhost/api/athletes/${ATHLETE_ID}/injuries/${INJURY_ID}`,
      "PATCH",
      { severity: 4 },
    );
    const response = await PATCH(
      req as Parameters<typeof PATCH>[0],
      routeContext(ATHLETE_ID, INJURY_ID),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono zawodnika.");
  });
});

// ============================================================
// DELETE /api/athletes/[id]/injuries/[injuryId]
// ============================================================

describe("DELETE /api/athletes/[id]/injuries/[injuryId]", () => {
  it("returns 204 when injury is deleted", async () => {
    setupAuthenticated();
    mockDataAthlete.getAthleteById.mockResolvedValue(ATHLETE);
    mockDataInjury.deleteInjury.mockResolvedValue(undefined);

    const req = makeRequest(
      `http://localhost/api/athletes/${ATHLETE_ID}/injuries/${INJURY_ID}`,
      "DELETE",
    );
    const response = await DELETE(
      req as Parameters<typeof DELETE>[0],
      routeContext(ATHLETE_ID, INJURY_ID),
    );

    expect(response.status).toBe(204);
  });

  it("returns 404 when athlete not found", async () => {
    setupAuthenticated();
    mockDataAthlete.getAthleteById.mockResolvedValue(null);

    const req = makeRequest(
      `http://localhost/api/athletes/${ATHLETE_ID}/injuries/${INJURY_ID}`,
      "DELETE",
    );
    const response = await DELETE(
      req as Parameters<typeof DELETE>[0],
      routeContext(ATHLETE_ID, INJURY_ID),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono zawodnika.");
  });
});
