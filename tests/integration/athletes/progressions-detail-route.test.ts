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

import { PATCH, DELETE } from "@/app/api/athletes/[id]/progressions/[entryId]/route";

const COACH_USER = { id: "coach-uuid-001", email: "coach@test.com" };
const ATHLETE_ID = "athlete-uuid-001";
const ENTRY_ID = "entry-uuid-001";
const ENTRY = {
  id: ENTRY_ID,
  athlete_id: ATHLETE_ID,
  exercise_name: "Przysiad ze sztanga",
  entry_date: "2026-08-19",
  weight_kg: 105,
  reps: "6",
  sets: "3",
  note: "Ciezko",
  source: "coach",
  created_at: "2026-08-19T12:00:00Z",
  updated_at: "2026-08-20T10:00:00Z",
};

function routeContext() {
  return { params: Promise.resolve({ id: ATHLETE_ID, entryId: ENTRY_ID }) };
}

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(
    `http://localhost/api/athletes/${ATHLETE_ID}/progressions/${ENTRY_ID}`,
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

  const eq = vi.fn().mockReturnThis();
  const deleteChain = {
    eq: (...args: unknown[]) => {
      eq(...args);
      return deleteChain;
    },
    then: (resolve: (value: unknown) => void) => resolve(deleteResult),
  };

  return {
    select: vi.fn().mockReturnThis(),
    eq,
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

describe("PATCH /api/athletes/[id]/progressions/[entryId]", () => {
  it("returns 401 when unauthenticated", async () => {
    setupUnauthenticated();

    const response = await PATCH(
      makeRequest("PATCH", { weight_kg: 110 }) as Parameters<typeof PATCH>[0],
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
      makeRequest("PATCH", { weight_kg: 0 }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("returns 400 for invalid JSON body", async () => {
    setupAuthenticated();

    const response = await PATCH(
      new Request(
        `http://localhost/api/athletes/${ATHLETE_ID}/progressions/${ENTRY_ID}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "{not json",
        },
      ) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty patch body", async () => {
    setupAuthenticated();

    const response = await PATCH(
      makeRequest("PATCH", {}) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Nie podano żadnych pól do aktualizacji.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 404 when entry does not exist", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: null, error: { code: "PGRST116", message: "No rows" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await PATCH(
      makeRequest("PATCH", { weight_kg: 110 }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono wpisu progresji.");
  });

  it("returns 200 with normalized exercise name when entry is updated", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [{ data: ENTRY, error: null }],
    });
    mockFrom.mockReturnValue(builder);

    const response = await PATCH(
      makeRequest("PATCH", {
        exercise_name: "  Przysiad   ze   sztanga ",
        weight_kg: ENTRY.weight_kg,
        reps: ENTRY.reps,
        sets: ENTRY.sets,
        note: ENTRY.note,
      }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual(ENTRY);
    expect(builder.update).toHaveBeenCalledWith({
      exercise_name: "Przysiad ze sztanga",
      weight_kg: ENTRY.weight_kg,
      reps: ENTRY.reps,
      sets: ENTRY.sets,
      note: ENTRY.note,
    });
    expect(builder.eq).toHaveBeenCalledWith("athlete_id", ATHLETE_ID);
    expect(builder.eq).toHaveBeenCalledWith("id", ENTRY_ID);
  });

  it("returns 409 when the patch would collide with another entry", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await PATCH(
      makeRequest("PATCH", { exercise_name: "Martwy ciag" }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("Wpis progresji dla tego ćwiczenia i dnia już istnieje.");
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
      makeRequest("PATCH", { weight_kg: 110 }) as Parameters<typeof PATCH>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(typeof json.error).toBe("string");
    expect(json.error).toContain("progresji");
    expect(json.details).toBeUndefined();
  });
});

describe("DELETE /api/athletes/[id]/progressions/[entryId]", () => {
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

  it("returns 204 when entry is deleted", async () => {
    setupAuthenticated();
    const builder = makeBuilder({ deleteResult: { error: null, count: 1 } });
    mockFrom.mockReturnValue(builder);

    const response = await DELETE(
      makeRequest("DELETE") as Parameters<typeof DELETE>[0],
      routeContext(),
    );

    expect(response.status).toBe(204);
    expect(builder.delete).toHaveBeenCalledWith({ count: "exact" });
    expect(builder.eq).toHaveBeenCalledWith("athlete_id", ATHLETE_ID);
    expect(builder.eq).toHaveBeenCalledWith("id", ENTRY_ID);
  });

  it("returns 404 when entry does not exist", async () => {
    setupAuthenticated();
    const builder = makeBuilder({ deleteResult: { error: null, count: 0 } });
    mockFrom.mockReturnValue(builder);

    const response = await DELETE(
      makeRequest("DELETE") as Parameters<typeof DELETE>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono wpisu progresji.");
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
    expect(json.error).toContain("progresji");
    expect(json.details).toBeUndefined();
  });
});