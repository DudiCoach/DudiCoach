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

import { PATCH, DELETE } from "@/app/api/athletes/[id]/diagnostics/[findingId]/route";

const COACH_USER = { id: "coach-uuid-001", email: "coach@test.com" };
const ATHLETE_ID = "athlete-uuid-001";
const FINDING_ID = "finding-uuid-001";
const FINDING = {
  id: FINDING_ID,
  athlete_id: ATHLETE_ID,
  muscle_key: "anterior_deltoid",
  side: "left",
  severity: "very_weak",
  notes: "Po treningu",
  observed_at: "2026-08-20",
  created_at: "2026-08-19T12:00:00Z",
  updated_at: "2026-08-20T10:00:00Z",
};

function routeContext() {
  return { params: Promise.resolve({ id: ATHLETE_ID, findingId: FINDING_ID }) };
}

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(
    `http://localhost/api/athletes/${ATHLETE_ID}/diagnostics/${FINDING_ID}`,
    init,
  );
}

function makeBuilder(options?: {
  singleSequence?: Array<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
  singleDefault?: { data: unknown; error: { code?: string; message?: string } | null };
  deleteResult?: { error: { code?: string; message?: string } | null; count: number | null };
}) {
  const single = vi.fn();
  for (const result of options?.singleSequence ?? []) {
    single.mockResolvedValueOnce(result);
  }
  single.mockResolvedValue(
    options?.singleDefault ?? { data: { share_active: false, share_code: "ABC234" }, error: null },
  );

  const deleteResult = options?.deleteResult ?? { error: null, count: 1 };

  const deleteChain = {
    eq: () => deleteChain,
    then: (resolve: (value: unknown) => void) => resolve(deleteResult),
  };

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single,
    delete: vi.fn().mockReturnValue(deleteChain),
  };
}

function setupAuthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: COACH_USER }, error: null });
}

function setupUnauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/athletes/[id]/diagnostics/[findingId]", () => {
  it("returns 401 when unauthenticated", async () => {
    setupUnauthenticated();

    const response = await PATCH(
      makeRequest("PATCH", { severity: "dysfunction" }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid body", async () => {
    setupAuthenticated();

    const response = await PATCH(
      makeRequest("PATCH", { severity: "perfect" }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("returns 404 when finding does not exist", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: null, error: { code: "PGRST116", message: "No rows" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await PATCH(
      makeRequest("PATCH", { severity: "dysfunction" }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono znaleziska.");
  });

  it("returns 200 when finding is updated", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [{ data: FINDING, error: null }],
    });
    mockFrom.mockReturnValue(builder);

    const response = await PATCH(
      makeRequest("PATCH", {
        severity: FINDING.severity,
        notes: FINDING.notes,
        observed_at: FINDING.observed_at,
      }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual(FINDING);
  });

  it("returns 409 when the patch would collide with another finding", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await PATCH(
      makeRequest("PATCH", { muscle_key: "soleus", side: "right" }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("Znalezisko dla tego mięśnia i strony już istnieje.");
  });

  it("returns 500 without details on unexpected Supabase update error", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: null, error: { code: "XX000", message: "update failed" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await PATCH(
      makeRequest("PATCH", { severity: "dysfunction" }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(typeof json.error).toBe("string");
    expect(json.error).toContain("znaleziska");
    expect(json.details).toBeUndefined();
  });
});

describe("DELETE /api/athletes/[id]/diagnostics/[findingId]", () => {
  it("returns 401 when unauthenticated", async () => {
    setupUnauthenticated();

    const response = await DELETE(
      makeRequest("DELETE") as Parameters<typeof DELETE>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 204 when finding is deleted", async () => {
    setupAuthenticated();
    const builder = makeBuilder({ deleteResult: { error: null, count: 1 } });
    mockFrom.mockReturnValue(builder);

    const response = await DELETE(
      makeRequest("DELETE") as Parameters<typeof DELETE>[0],
      routeContext(),
    );

    expect(response.status).toBe(204);
  });

  it("returns 404 when finding does not exist", async () => {
    setupAuthenticated();
    const builder = makeBuilder({ deleteResult: { error: null, count: 0 } });
    mockFrom.mockReturnValue(builder);

    const response = await DELETE(
      makeRequest("DELETE") as Parameters<typeof DELETE>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono znaleziska.");
  });

  it("returns 500 without details on unexpected Supabase delete error", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      deleteResult: { error: { code: "XX000", message: "delete failed" }, count: null },
    });
    mockFrom.mockReturnValue(builder);

    const response = await DELETE(
      makeRequest("DELETE") as Parameters<typeof DELETE>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(typeof json.error).toBe("string");
    expect(json.error).toContain("znaleziska");
    expect(json.details).toBeUndefined();
  });
});