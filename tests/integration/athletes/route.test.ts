/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the data layer AND auth guard
// ---------------------------------------------------------------------------

const mockData = vi.hoisted(() => ({
  getAthletesByCoach: vi.fn(),
  getAthleteById: vi.fn(),
  createAthlete: vi.fn(),
  updateAthlete: vi.fn(),
  deleteAthlete: vi.fn(),
}));

vi.mock("@/lib/data/athlete", () => mockData);

const { mockRequireAuth } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn();
  return { mockRequireAuth };
});

vi.mock("@/lib/api/auth-guard", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// Import route handlers AFTER mocks
import { GET as listAthletes, POST } from "@/app/api/athletes/route";
import { GET as getAthlete, PATCH, DELETE } from "@/app/api/athletes/[id]/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COACH_USER = { uid: "coach-uuid-001", email: "coach@test.com" };

const mockAthlete = {
  id: "athlete-uuid-001",
  coach_id: COACH_USER.uid,
  name: "Jan Kowalski",
  age: 25,
  weight_kg: 75.0,
  height_cm: 180.0,
  sport: "Pływanie",
  training_start_date: "2024-01-01",
  training_days_per_week: 5,
  session_minutes: 90,
  current_phase: "base",
  goal: "Wydolność",
  notes: null,
  share_code: "ABC123",
  share_active: false,
  created_at: "2026-04-10T10:00:00Z",
  updated_at: "2026-04-10T12:00:00Z",
};

const mockAthlete2 = { ...mockAthlete, id: "athlete-uuid-002", name: "Anna Nowak" };
const mockAthlete3 = { ...mockAthlete, id: "athlete-uuid-003", name: "Piotr Wiśniewski" };

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

// ============================================================
// POST /api/athletes
// ============================================================

describe("POST /api/athletes", () => {
  it("authenticated + valid body → 201 + athlete in response", async () => {
    setupAuthenticated();
    mockData.createAthlete.mockResolvedValue(mockAthlete);

    const req = makeRequest("http://localhost/api/athletes", "POST", { name: "Jan Kowalski" });
    const response = await POST(req as Parameters<typeof POST>[0]);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.name).toBe("Jan Kowalski");
    expect(mockData.createAthlete).toHaveBeenCalled();
  });

  it("authenticated + missing name → 400 validation error", async () => {
    setupAuthenticated();

    const req = makeRequest("http://localhost/api/athletes", "POST", { age: 25 });
    const response = await POST(req as Parameters<typeof POST>[0]);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(Array.isArray(json.details)).toBe(true);
  });

  it("unauthenticated → 401", async () => {
    setupUnauthenticated();

    const req = makeRequest("http://localhost/api/athletes", "POST", { name: "Jan Kowalski" });
    const response = await POST(req as Parameters<typeof POST>[0]);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockData.createAthlete).not.toHaveBeenCalled();
  });

  it("Firestore error → 500", async () => {
    setupAuthenticated();
    mockData.createAthlete.mockRejectedValue(new Error("Firestore error"));

    const req = makeRequest("http://localhost/api/athletes", "POST", { name: "Jan Kowalski" });
    const response = await POST(req as Parameters<typeof POST>[0]);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });
});

// ============================================================
// GET /api/athletes (list)
// ============================================================

describe("GET /api/athletes", () => {
  it("authenticated + athletes in DB → 200 + array", async () => {
    setupAuthenticated();
    mockData.getAthletesByCoach.mockResolvedValue([mockAthlete, mockAthlete2, mockAthlete3]);

    const response = await listAthletes();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(3);
  });

  it("authenticated + empty DB → 200 + empty array", async () => {
    setupAuthenticated();
    mockData.getAthletesByCoach.mockResolvedValue([]);

    const response = await listAthletes();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  it("unauthenticated → 401", async () => {
    setupUnauthenticated();

    const response = await listAthletes();
    await response.json();

    expect(response.status).toBe(401);
    expect(mockData.getAthletesByCoach).not.toHaveBeenCalled();
  });
});

// ============================================================
// GET /api/athletes/[id]
// ============================================================

describe("GET /api/athletes/[id]", () => {
  it("authenticated + existing athlete → 200 + athlete", async () => {
    setupAuthenticated();
    mockData.getAthleteById.mockResolvedValue(mockAthlete);

    const req = makeRequest("http://localhost/api/athletes/athlete-uuid-001", "GET");
    const response = await getAthlete(req as Parameters<typeof getAthlete>[0], routeContext("athlete-uuid-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.name).toBe("Jan Kowalski");
  });

  it("authenticated + non-existent ID → 404", async () => {
    setupAuthenticated();
    mockData.getAthleteById.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/athletes/nonexistent-id", "GET");
    const response = await getAthlete(req as Parameters<typeof getAthlete>[0], routeContext("nonexistent-id"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("unauthenticated → 401", async () => {
    setupUnauthenticated();

    const req = makeRequest("http://localhost/api/athletes/athlete-uuid-001", "GET");
    const response = await getAthlete(req as Parameters<typeof getAthlete>[0], routeContext("athlete-uuid-001"));
    await response.json();

    expect(response.status).toBe(401);
    expect(mockData.getAthleteById).not.toHaveBeenCalled();
  });
});

// ============================================================
// PATCH /api/athletes/[id]
// ============================================================

describe("PATCH /api/athletes/[id]", () => {
  it("authenticated + valid partial body → 200 + updated athlete", async () => {
    setupAuthenticated();
    const updated = { ...mockAthlete, weight_kg: 78.0 };
    mockData.getAthleteById.mockResolvedValue(mockAthlete);
    mockData.updateAthlete.mockResolvedValue(updated);

    const req = makeRequest("http://localhost/api/athletes/athlete-uuid-001", "PATCH", { weight_kg: 78 });
    const response = await PATCH(req as Parameters<typeof PATCH>[0], routeContext("athlete-uuid-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.weight_kg).toBe(78.0);
  });

  it("authenticated + non-existent ID → 404", async () => {
    setupAuthenticated();
    mockData.getAthleteById.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/athletes/nonexistent-id", "PATCH", { weight_kg: 78 });
    const response = await PATCH(req as Parameters<typeof PATCH>[0], routeContext("nonexistent-id"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("unauthenticated → 401", async () => {
    setupUnauthenticated();

    const req = makeRequest("http://localhost/api/athletes/athlete-uuid-001", "PATCH", { weight_kg: 78 });
    const response = await PATCH(req as Parameters<typeof PATCH>[0], routeContext("athlete-uuid-001"));
    await response.json();

    expect(response.status).toBe(401);
    expect(mockData.updateAthlete).not.toHaveBeenCalled();
  });
});

// ============================================================
// DELETE /api/athletes/[id]
// ============================================================

describe("DELETE /api/athletes/[id]", () => {
  it("authenticated + existing athlete → 204 no body", async () => {
    setupAuthenticated();
    mockData.getAthleteById.mockResolvedValue(mockAthlete);
    mockData.deleteAthlete.mockResolvedValue(undefined);

    const req = makeRequest("http://localhost/api/athletes/athlete-uuid-001", "DELETE");
    const response = await DELETE(req as Parameters<typeof DELETE>[0], routeContext("athlete-uuid-001"));

    expect(response.status).toBe(204);
  });

  it("authenticated + non-existent ID → 404", async () => {
    setupAuthenticated();
    mockData.getAthleteById.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/athletes/nonexistent-id", "DELETE");
    const response = await DELETE(req as Parameters<typeof DELETE>[0], routeContext("nonexistent-id"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("unauthenticated → 401", async () => {
    setupUnauthenticated();

    const req = makeRequest("http://localhost/api/athletes/athlete-uuid-001", "DELETE");
    const response = await DELETE(req as Parameters<typeof DELETE>[0], routeContext("athlete-uuid-001"));
    await response.json();

    expect(response.status).toBe(401);
    expect(mockData.deleteAthlete).not.toHaveBeenCalled();
  });
});
