/// <reference types="vitest/globals" />

import { beforeEach, vi } from "vitest";

const { mockRpc } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  return { mockRpc };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
  })),
}));

import {
  GET,
  POST,
} from "@/app/api/athlete/[shareCode]/plans/[planId]/feedback/route";

const PLAN_ID = "550e8400-e29b-41d4-a716-446655440000";

function routeContext(shareCode: string, planId = PLAN_ID) {
  return { params: Promise.resolve({ shareCode, planId }) };
}

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/athlete/ABC234/plans/plan/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(query = "") {
  return new Request(
    `http://localhost/api/athlete/ABC234/plans/${PLAN_ID}/feedback${query}`,
    {
      method: "GET",
    },
  );
}

const FEEDBACK_ROW = {
  id: "3dd7876d-5522-4d67-a7f7-f2a2b62a12f4",
  plan_id: PLAN_ID,
  athlete_id: "1b89fb8d-9b84-4ec0-a37e-d2828d97e661",
  week_number: 2,
  day_number: 3,
  feedback_text: "Czulem zmeczenie, ale plan byl wykonalny.",
  created_at: "2026-05-22T10:00:00.000Z",
  updated_at: "2026-05-22T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/athlete/[shareCode]/plans/[planId]/feedback", () => {
  it("returns 404 for invalid share code format", async () => {
    const response = await POST(
      makePostRequest({
        weekNumber: 1,
        dayNumber: 1,
        feedbackText: "ok",
      }) as Parameters<typeof POST>[0],
      routeContext("abc123"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid body", async () => {
    const response = await POST(
      makePostRequest({
        weekNumber: 0,
        dayNumber: 8,
        feedbackText: "",
      }) as Parameters<typeof POST>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 for whitespace-only feedback", async () => {
    const response = await POST(
      makePostRequest({
        weekNumber: 1,
        dayNumber: 2,
        feedbackText: "    \n\t   ",
      }) as Parameters<typeof POST>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 for too-long feedback", async () => {
    const response = await POST(
      makePostRequest({
        weekNumber: 1,
        dayNumber: 2,
        feedbackText: "a".repeat(2001),
      }) as Parameters<typeof POST>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 200 for valid feedback and calls RPC with sanitized feedback text", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ ...FEEDBACK_ROW, feedback_text: "Dobry trening.\nWysokie tetno." }],
      error: null,
    });

    const response = await POST(
      makePostRequest({
        weekNumber: 2,
        dayNumber: 3,
        feedbackText: "  Dobry trening.\x01\nWysokie tetno.  ",
      }) as Parameters<typeof POST>[0],
      routeContext("abc234"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.feedback_text).toBe("Dobry trening.\nWysokie tetno.");
    expect(mockRpc).toHaveBeenCalledWith("upsert_plan_session_feedback", {
      p_code: "ABC234",
      p_plan_id: PLAN_ID,
      p_week_number: 2,
      p_day_number: 3,
      p_feedback_text: "Dobry trening.\nWysokie tetno.",
    });
  });

  it("returns 404 for wrong plan/share ownership (no row returned)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const response = await POST(
      makePostRequest({
        weekNumber: 1,
        dayNumber: 1,
        feedbackText: "Feedback",
      }) as Parameters<typeof POST>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
  });
});

describe("GET /api/athlete/[shareCode]/plans/[planId]/feedback", () => {
  it("returns 404 for invalid share code format", async () => {
    const response = await GET(
      makeGetRequest("?weekNumber=1&dayNumber=1") as Parameters<typeof GET>[0],
      routeContext("abc123"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid query", async () => {
    const response = await GET(
      makeGetRequest("?weekNumber=foo&dayNumber=1") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 200 with row for success", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [FEEDBACK_ROW],
      error: null,
    });

    const response = await GET(
      makeGetRequest("?weekNumber=2&dayNumber=3") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe(FEEDBACK_ROW.id);
    expect(mockRpc).toHaveBeenCalledWith(
      "get_plan_session_feedback_by_share_code",
      {
        p_code: "ABC234",
        p_plan_id: PLAN_ID,
        p_week_number: 2,
        p_day_number: 3,
      },
    );
  });

  it("returns 200 with data:null when feedback row does not exist", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const response = await GET(
      makeGetRequest("?weekNumber=2&dayNumber=3") as Parameters<typeof GET>[0],
      routeContext("ABC234"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toBeNull();
  });
});
