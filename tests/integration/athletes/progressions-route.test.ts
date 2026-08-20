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

import { GET, POST } from "@/app/api/athletes/[id]/progressions/route";

const COACH_USER = { id: "coach-uuid-001", email: "coach@test.com" };
const ATHLETE_ID = "athlete-uuid-001";
const ENTRY = {
  id: "entry-uuid-001",
  athlete_id: ATHLETE_ID,
  exercise_name: "Przysiad ze sztanga",
  entry_date: "2026-08-19",
  weight_kg: 100,
  reps: "6",
  sets: "3",
  note: "Ciezko",
  source: "coach",
  created_at: "2026-08-19T12:00:00Z",
  updated_at: "2026-08-19T12:00:00Z",
};

function routeContext(id = ATHLETE_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(
    `http://localhost/api/athletes/${ATHLETE_ID}/progressions`,
    init,
  );
}

function makeBuilder(options?: {
  singleSequence?: Array<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
  singleDefault?: { data: unknown; error: { code?: string; message?: string } | null };
  orderResult?: { data: unknown; error: { code?: string; message?: string } | null };
}) {
  const single = vi.fn();
  for (const result of options?.singleSequence ?? []) {
    single.mockResolvedValueOnce(result);
  }
  single.mockResolvedValue(
    options?.singleDefault ?? { data: { share_active: false, share_code: "ABC234" }, error: null },
  );

  const orderResult = options?.orderResult ?? { data: [], error: null };
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single,
    then: (resolve: (value: unknown) => void) => resolve(orderResult),
  };

  return builder;
}

function setupAuthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: COACH_USER }, error: null });
}

function setupUnauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

function setupAuthError() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { code: "401", message: "JWT expired" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/athletes/[id]/progressions", () => {
  it("returns 401 when unauthenticated", async () => {
    setupUnauthenticated();

    const response = await GET(
      makeRequest("GET") as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 401 when auth.getUser fails", async () => {
    setupAuthError();

    const response = await GET(
      makeRequest("GET") as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 404 when athlete does not exist or is not owned", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: null, error: { code: "PGRST116", message: "No rows" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await GET(
      makeRequest("GET") as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono zawodnika.");
    expect(builder.order).not.toHaveBeenCalled();
  });

  it("returns 500 without details when athlete pre-check fails unexpectedly", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: null, error: { code: "XX000", message: "query failed" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await GET(
      makeRequest("GET") as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(typeof json.error).toBe("string");
    expect(json.error).toContain("progresji");
    expect(json.details).toBeUndefined();
  });

  it("returns 200 + entries list ordered by exercise then date when athlete exists", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [{ data: { id: ATHLETE_ID }, error: null }],
      orderResult: { data: [ENTRY], error: null },
    });
    mockFrom.mockReturnValue(builder);

    const response = await GET(
      makeRequest("GET") as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual([ENTRY]);
    expect(builder.order).toHaveBeenCalledWith("exercise_name", { ascending: true });
    expect(builder.order).toHaveBeenCalledWith("entry_date", { ascending: true });
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("returns 500 without details on entries query failure", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [{ data: { id: ATHLETE_ID }, error: null }],
      orderResult: {
        data: null,
        error: { code: "XX000", message: "query failed" },
      },
    });
    mockFrom.mockReturnValue(builder);

    const response = await GET(
      makeRequest("GET") as Parameters<typeof GET>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(typeof json.error).toBe("string");
    expect(json.error).toContain("progresji");
    expect(json.details).toBeUndefined();
  });
});

describe("POST /api/athletes/[id]/progressions", () => {
  it("returns 401 when unauthenticated", async () => {
    setupUnauthenticated();

    const response = await POST(
      makeRequest("POST", {
        exercise_name: "Przysiad",
        entry_date: "2026-08-19",
        weight_kg: 100,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Brak autoryzacji.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid body", async () => {
    setupAuthenticated();

    const response = await POST(
      makeRequest("POST", {
        exercise_name: "",
        entry_date: "19-08-2026",
        weight_kg: 0,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("returns 400 for invalid JSON body", async () => {
    setupAuthenticated();

    const response = await POST(
      new Request(`http://localhost/api/athletes/${ATHLETE_ID}/progressions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 404 when athlete does not exist or is not owned", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: null, error: { code: "PGRST116", message: "No rows" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await POST(
      makeRequest("POST", {
        exercise_name: "Przysiad",
        entry_date: "2026-08-19",
        weight_kg: 100,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono zawodnika.");
  });

  it("returns 201 with normalized exercise name and forced source when created", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: { id: ATHLETE_ID }, error: null },
        { data: ENTRY, error: null },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await POST(
      makeRequest("POST", {
        exercise_name: "  Przysiad   ze   sztanga ",
        entry_date: ENTRY.entry_date,
        weight_kg: ENTRY.weight_kg,
        reps: ENTRY.reps,
        sets: ENTRY.sets,
        note: ENTRY.note,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data).toEqual(ENTRY);
    expect(builder.insert).toHaveBeenCalledWith({
      athlete_id: ATHLETE_ID,
      exercise_name: "Przysiad ze sztanga",
      entry_date: ENTRY.entry_date,
      weight_kg: ENTRY.weight_kg,
      reps: ENTRY.reps,
      sets: ENTRY.sets,
      note: ENTRY.note,
      source: "coach",
    });
  });

  it("strips hostile source/athlete_id from the body (server-controlled fields)", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: { id: ATHLETE_ID }, error: null },
        { data: ENTRY, error: null },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await POST(
      makeRequest("POST", {
        exercise_name: ENTRY.exercise_name,
        entry_date: ENTRY.entry_date,
        weight_kg: ENTRY.weight_kg,
        source: "athlete",
        athlete_id: "another-athlete-uuid",
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data).toEqual(ENTRY);
    expect(builder.insert).toHaveBeenCalledWith({
      athlete_id: ATHLETE_ID,
      exercise_name: ENTRY.exercise_name,
      entry_date: ENTRY.entry_date,
      weight_kg: ENTRY.weight_kg,
      reps: undefined,
      sets: undefined,
      note: undefined,
      source: "coach",
    });
  });

  it("returns 404 for FK violation (athlete disappeared between checks)", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: { id: ATHLETE_ID }, error: null },
        { data: null, error: { code: "23503", message: "fk violation" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await POST(
      makeRequest("POST", {
        exercise_name: "Przysiad",
        entry_date: "2026-08-19",
        weight_kg: 100,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Nie znaleziono zawodnika.");
  });

  it("returns 409 when (athlete, exercise, day) already exists", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: { id: ATHLETE_ID }, error: null },
        {
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await POST(
      makeRequest("POST", {
        exercise_name: "Przysiad",
        entry_date: "2026-08-19",
        weight_kg: 100,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("Wpis progresji dla tego ćwiczenia i dnia już istnieje.");
  });

  it("returns 500 without details on unexpected Supabase insert error", async () => {
    setupAuthenticated();
    const builder = makeBuilder({
      singleSequence: [
        { data: { id: ATHLETE_ID }, error: null },
        { data: null, error: { code: "XX000", message: "write failed" } },
      ],
    });
    mockFrom.mockReturnValue(builder);

    const response = await POST(
      makeRequest("POST", {
        exercise_name: "Przysiad",
        entry_date: "2026-08-19",
        weight_kg: 100,
      }) as Parameters<typeof POST>[0],
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(typeof json.error).toBe("string");
    expect(json.error).toContain("progresji");
    expect(json.details).toBeUndefined();
  });
});