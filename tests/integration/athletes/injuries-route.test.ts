/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the data layer AND auth guard
// ---------------------------------------------------------------------------

const mockDataAthlete = vi.hoisted(() => ({
  getAthleteById: vi.fn(),
}));

const mockDataInjury = vi.hoisted(() => ({
  getInjuries: vi.fn(),
  createInjury: vi.fn(),
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

import { GET, POST } from "@/app/api/athletes/[id]/injuries/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COACH_USER = { uid: "coach-uuid-001", email: "coach@test.com" };
const ATHLETE_ID = "athlete-uuid-001";

const INJURY = {
  id: "injury-uuid-001",
  athlete_id: ATHLETE_ID,
  name: "Naciągnięcie dwugłowego",
  body_location: "hamstring",
  severity: 3,
  injury_date: "2026-04-16",
  status: "active",
  notes: "Ból przy biegu",
  created_at: "2026-04-16T10:00:00Z",
  updated_at: "2026-04-16T10:00:00Z",
};

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

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function setupAuthenticated() {
  mockRequireAuth.mockResolvedValue({ user: COACH_USER, response: null });
}


beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// GET /api/athletes/[id]/injuries
// ============================================================

describe("GET /api/athletes/[id]/injuries", () => {
  it("returns 200 + injuries list when athlete exists", async () => {
    setupAuthenticated();
    mockDataAthlete.getAthleteById.mockResolvedValue(ATHLETE);
    mockDataInjury.getInjuries.mockResolvedValue([INJURY]);

    const req = makeRequest(`http://localhost/api/athletes/${ATHLETE_ID}/injuries`, "GET");
    const response = await GET(req as Parameters<typeof GET>[0], routeContext(ATHLETE_ID));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("Naciągnięcie dwugłowego");
  });

  it("returns 404 when athlete not found", async () => {
    setupAuthenticated();
    mockDataAthlete.getAthleteById.mockResolvedValue(null);

    const req = makeRequest(`http://localhost/api/athletes/${ATHLETE_ID}/injuries`, "GET");
    const response = await GET(req as Parameters<typeof GET>[0], routeContext(ATHLETE_ID));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono zawodnika.");
  });
});

// ============================================================
// POST /api/athletes/[id]/injuries
// ============================================================

describe("POST /api/athletes/[id]/injuries", () => {
  it("returns 201 when injury is created", async () => {
    setupAuthenticated();
    mockDataAthlete.getAthleteById.mockResolvedValue(ATHLETE);
    mockDataInjury.createInjury.mockResolvedValue(INJURY);

    const req = makeRequest(`http://localhost/api/athletes/${ATHLETE_ID}/injuries`, "POST", {
      name: "Naciągnięcie dwugłowego",
      body_location: "hamstring",
      severity: 3,
      injury_date: "2026-04-16",
    });
    const response = await POST(req as Parameters<typeof POST>[0], routeContext(ATHLETE_ID));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.name).toBe("Naciągnięcie dwugłowego");
  });

  it("returns 404 when athlete not found", async () => {
    setupAuthenticated();
    mockDataAthlete.getAthleteById.mockResolvedValue(null);

    const req = makeRequest(`http://localhost/api/athletes/${ATHLETE_ID}/injuries`, "POST", {
      name: "Naciągnięcie dwugłowego",
      body_location: "hamstring",
      severity: 3,
      injury_date: "2026-04-16",
    });
    const response = await POST(req as Parameters<typeof POST>[0], routeContext(ATHLETE_ID));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono zawodnika.");
  });
});
