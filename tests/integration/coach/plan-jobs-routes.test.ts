/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const { mockRequireAuth, mockGetAthleteById, mockCreatePlanJob, mockCheckJobRateLimit, mockGetPlanJobsByAthlete, mockGetPlanJob } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn();
  const mockGetAthleteById = vi.fn();
  const mockCreatePlanJob = vi.fn();
  const mockCheckJobRateLimit = vi.fn();
  const mockGetPlanJobsByAthlete = vi.fn();
  const mockGetPlanJob = vi.fn();
  return { mockRequireAuth, mockGetAthleteById, mockCreatePlanJob, mockCheckJobRateLimit, mockGetPlanJobsByAthlete, mockGetPlanJob };
});

vi.mock("@/lib/api/auth-guard", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAthleteById: mockGetAthleteById,
}));

vi.mock("@/lib/data/plan-job", () => ({
  createPlanJob: mockCreatePlanJob,
  checkJobRateLimit: mockCheckJobRateLimit,
  getPlanJobsByAthlete: mockGetPlanJobsByAthlete,
  getPlanJob: mockGetPlanJob,
}));

import { POST } from "@/app/api/coach/plans/jobs/route";
import { GET } from "@/app/api/coach/plans/jobs/[jobId]/route";

const COACH_USER = { uid: "coach-uuid-001", email: "coach@test.com" };
const ATHLETE_ID = "550e8400-e29b-41d4-a716-446655440111";

const ATHLETE_DATA = {
  id: ATHLETE_ID,
  data: {
    coachId: COACH_USER.uid,
    name: "US-026 Athlete",
    age: 22,
    weightKg: 78,
    heightCm: 180,
    sport: "silownia",
    trainingStartDate: "2025-01-01",
    trainingDaysPerWeek: 4,
    sessionMinutes: 60,
    currentPhase: "building",
    goal: "strength",
    notes: null,
    shareCode: "ABC234",
    shareActive: false,
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  },
};

const JOB = {
  id: "job-uuid-001",
  athlete_id: ATHLETE_ID,
  coach_id: COACH_USER.uid,
  status: "pending" as const,
  plan_id: null,
  error_code: null,
  error_message: null,
  attempt_count: 0,
  max_attempts: 3,
  claim_token: null,
  claimed_at: null,
  processing_started_at: null,
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: COACH_USER, response: null });
  mockGetAthleteById.mockResolvedValue(ATHLETE_DATA);
  mockCreatePlanJob.mockResolvedValue(JOB);
  mockCheckJobRateLimit.mockResolvedValue({ allowed: true });
  mockGetPlanJobsByAthlete.mockResolvedValue([]);
  mockGetPlanJob.mockResolvedValue(JOB);
});

describe("POST /api/coach/plans/jobs", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "Brak autoryzacji." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const request = new Request("http://localhost/api/coach/plans/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: ATHLETE_ID }),
    });
    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(401);
  });

  it("returns 400 when athleteId is missing", async () => {
    const request = new Request("http://localhost/api/coach/plans/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("athleteId is required");
  });

  it("returns 404 when athlete does not exist", async () => {
    mockGetAthleteById.mockResolvedValue(null);

    const request = new Request("http://localhost/api/coach/plans/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: ATHLETE_ID }),
    });
    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("returns 404 when athlete is not owned by coach", async () => {
    mockGetAthleteById.mockResolvedValue({
      ...ATHLETE_DATA,
      data: { ...ATHLETE_DATA.data, coachId: "other-coach-id" },
    });

    const request = new Request("http://localhost/api/coach/plans/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: ATHLETE_ID }),
    });
    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(404);
  });

  it("returns 422 when athlete data is incomplete", async () => {
    mockGetAthleteById.mockResolvedValue({
      ...ATHLETE_DATA,
      data: { ...ATHLETE_DATA.data, sport: null },
    });

    const request = new Request("http://localhost/api/coach/plans/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: ATHLETE_ID }),
    });
    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toContain("Uzupełnij dane zawodnika");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckJobRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30000 });

    const request = new Request("http://localhost/api/coach/plans/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: ATHLETE_ID }),
    });
    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Zbyt wiele prób");
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 409 when an active job already exists", async () => {
    mockGetPlanJobsByAthlete.mockResolvedValue([JOB]);

    const request = new Request("http://localhost/api/coach/plans/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: ATHLETE_ID }),
    });
    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain("w toku");
  });

  it("creates job and returns 202", async () => {
    const request = new Request("http://localhost/api/coach/plans/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: ATHLETE_ID }),
    });
    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json.data).toBeDefined();
    expect(json.data.id).toBe("job-uuid-001");
    expect(json.data.status).toBe("pending");
    expect(mockCreatePlanJob).toHaveBeenCalledWith(ATHLETE_ID, COACH_USER.uid);
  });
});

describe("GET /api/coach/plans/jobs/[jobId]", () => {
  const GETrouteContext = (jobId: string) => ({ params: Promise.resolve({ jobId }) });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "Brak autoryzacji." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const response = await GET(new Request("http://localhost/api/coach/plans/jobs/job-uuid-001") as any, GETrouteContext("job-uuid-001"));
    const json = await response.json();

    expect(response.status).toBe(401);
  });

  it("returns 404 when job does not exist", async () => {
    mockGetPlanJob.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/coach/plans/jobs/job-uuid-001") as any, GETrouteContext("job-uuid-001"));
    const json = await response.json();

    expect(response.status).toBe(404);
  });

  it("returns 404 when job is not owned by coach", async () => {
    mockGetPlanJob.mockResolvedValue({
      ...JOB,
      coach_id: "other-coach-id",
    });

    const response = await GET(new Request("http://localhost/api/coach/plans/jobs/job-uuid-001") as any, GETrouteContext("job-uuid-001"));
    const json = await response.json();

    expect(response.status).toBe(404);
  });

  it("returns job status", async () => {
    const response = await GET(new Request("http://localhost/api/coach/plans/jobs/job-uuid-001") as any, GETrouteContext("job-uuid-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toBeDefined();
    expect(json.data.id).toBe("job-uuid-001");
  });
});
