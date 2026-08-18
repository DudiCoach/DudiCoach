import {
  test,
  expect,
  type APIRequestContext,
} from "@playwright/test";

/**
 * US-025 — Athlete Public Panel: Training Plan Display.
 *
 * Verifies the public plan endpoint and the public panel plan viewer against
 * the deployed app. Plan generation runs through the AI pipeline (US-026), so
 * fixtures are synthetic, prepared out-of-band, and passed in via env vars.
 * Codes are bearer credentials — they are never committed to the repo and are
 * rotated/deleted after the run (G9 closeout).
 *
 * Env contract (required for the production smoke):
 *   E2E_US025_PLAN_SHARE_CODE    — active code, synthetic athlete with two
 *                                  plans (newest = E2E_US025_EXPECTED_PLAN_ID)
 *   E2E_US025_EMPTY_SHARE_CODE   — active code, synthetic athlete with no plan
 *   E2E_US025_INACTIVE_SHARE_CODE— inactive code, synthetic athlete WITH a plan
 *   E2E_US025_RETIRED_SHARE_CODE — well-formed code that no longer resolves
 *                                  (derived by rotating one of the fixtures)
 *   E2E_US025_EXPECTED_PLAN_ID   — id of the newest plan of fixture A
 * Optional:
 *   E2E_US025_OLDER_PLAN_NAME    — name of the older plan of fixture A (asserted absent)
 *
 * All codes must be uppercase and match ^[A-HJ-NP-Z2-9]{6}$.
 */

const planCode = process.env.E2E_US025_PLAN_SHARE_CODE ?? "";
const emptyCode = process.env.E2E_US025_EMPTY_SHARE_CODE ?? "";
const inactiveCode = process.env.E2E_US025_INACTIVE_SHARE_CODE ?? "";
const retiredCode = process.env.E2E_US025_RETIRED_SHARE_CODE ?? "";
const expectedPlanId = process.env.E2E_US025_EXPECTED_PLAN_ID ?? "";
const olderPlanName = process.env.E2E_US025_OLDER_PLAN_NAME ?? "";
const isCI = !!process.env.CI;

const CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

function validateFixture(): string | null {
  if (!planCode) {
    return "Set E2E_US025_PLAN_SHARE_CODE to run the US-025 production smoke.";
  }
  const codes = [planCode, emptyCode, inactiveCode, retiredCode];
  for (const code of codes) {
    if (code !== code.toUpperCase()) {
      return "Fixture share codes must be uppercase.";
    }
    if (!CODE_REGEX.test(code)) {
      return `Fixture share code has invalid format: "${code}".`;
    }
  }
  if (new Set(codes).size !== codes.length) {
    return "Fixture share codes must be mutually distinct.";
  }
  if (!expectedPlanId) {
    return "Set E2E_US025_EXPECTED_PLAN_ID (newest plan id of fixture A).";
  }
  return null;
}

const fixtureError = validateFixture();

if (isCI && fixtureError) {
  throw new Error(`US-025 E2E fixture misconfiguration: ${fixtureError}`);
}

// Production smoke: do not capture trace/screenshot/video — fixture payloads
// are synthetic, but URLs contain bearer share codes.
test.use({ trace: "off", screenshot: "off", video: "off" });

interface PublicPlanFixture {
  id: string;
  plan_name: string;
  phase: string | null;
  created_at: string;
  plan_json: {
    planName: string;
    phase: string;
    summary: string;
    weeklyOverview: string;
    weeks: {
      weekNumber: number;
      focus: string;
      days: unknown[];
    }[];
    progressionNotes: string;
    nutritionTips: string;
    recoveryProtocol: string;
  };
}

const PUBLIC_TOP_KEYS = ["created_at", "id", "phase", "plan_json", "plan_name"];
const PLAN_JSON_KEYS = [
  "nutritionTips",
  "phase",
  "planName",
  "progressionNotes",
  "recoveryProtocol",
  "summary",
  "weeks",
  "weeklyOverview",
];
const WEEK_KEYS = ["days", "focus", "weekNumber"];
const DAY_KEYS = [
  "cooldown",
  "dayName",
  "dayNumber",
  "duration",
  "exercises",
  "warmup",
];
const EXERCISE_KEYS = ["intensity", "name", "notes", "reps", "rest", "sets", "tempo"];
const FORBIDDEN_KEYS = [
  "athlete_id",
  "athleteId",
  "coach_id",
  "coachId",
  "share_code",
  "shareCode",
];

function expectExactKeys(
  value: unknown,
  expected: string[],
  path: string,
): void {
  expect(value, `${path} must be an object`).toBeTruthy();
  expect(Object.keys(value as object).sort(), path).toEqual(
    [...expected].sort(),
  );
}

function assertNoForbiddenKeys(value: unknown, path = "data"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoForbiddenKeys(item, `${path}[${index}]`);
    });
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      expect(FORBIDDEN_KEYS, `forbidden key at ${path}.${key}`).not.toContain(
        key,
      );
      assertNoForbiddenKeys(child, `${path}.${key}`);
    }
  }
}

async function fetchPlan(
  request: APIRequestContext,
): Promise<PublicPlanFixture> {
  const response = await request.get(`/api/athlete/${planCode}/plans`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data: PublicPlanFixture };
  expect(body.data, "fixture A must return a plan").toBeTruthy();
  expect(body.data.id).toBe(expectedPlanId);
  return body.data;
}

test.describe("US-025 - athlete plan display", () => {
  test("AC-3: malformed share code returns 404 (API and page)", async ({
    page,
    request,
  }) => {
    const api = await request.get("/api/athlete/123/plans");
    expect(api.status()).toBe(404);
    expect(await api.json()).toEqual({ error: "Not found" });

    const response = await page.goto("/123");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("404", { exact: true }).first()).toBeVisible();
  });

  test.describe("production fixture smoke (G9)", () => {
    test.skip(
      fixtureError !== null,
      fixtureError ?? "Set E2E_US025_* fixture env vars to run.",
    );

    test("API-1: latest plan with exact public shape and no internal fields", async ({
      request,
    }, testInfo) => {
      test.skip(
        testInfo.project.name === "mobile-chrome",
        "API contract runs once on the desktop project.",
      );

      const response = await request.get(`/api/athlete/${planCode}/plans`);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as { data: PublicPlanFixture };
      expectExactKeys(body, ["data"], "body");
      expectExactKeys(body.data, PUBLIC_TOP_KEYS, "data");
      expect(body.data.id).toBe(expectedPlanId);
      expect(body.data.phase).toBeTruthy();

      const planJson = body.data.plan_json;
      expectExactKeys(planJson, PLAN_JSON_KEYS, "data.plan_json");
      expect(planJson.weeks).toHaveLength(4);
      expect(planJson.weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4]);
      for (const week of planJson.weeks) {
        expectExactKeys(week, WEEK_KEYS, "week");
        for (const day of week.days) {
          expectExactKeys(day, DAY_KEYS, "day");
          const exercises = (day as { exercises: unknown[] }).exercises;
          expect(exercises.length).toBeGreaterThan(0);
          for (const exercise of exercises) {
            expectExactKeys(exercise, EXERCISE_KEYS, "exercise");
          }
        }
      }

      assertNoForbiddenKeys(body);

      const serialized = JSON.stringify(body).toLowerCase();
      for (const code of [planCode, emptyCode, inactiveCode, retiredCode]) {
        expect(serialized, "share codes must never appear in the payload").not.toContain(
          code.toLowerCase(),
        );
      }
    });

    test("API-2: active code without a plan returns { data: null }", async ({
      request,
    }, testInfo) => {
      test.skip(
        testInfo.project.name === "mobile-chrome",
        "API contract runs once on the desktop project.",
      );

      const response = await request.get(`/api/athlete/${emptyCode}/plans`);
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ data: null });
    });

    test("API-3: inactive code hides existing plan data (404)", async ({
      request,
    }, testInfo) => {
      test.skip(
        testInfo.project.name === "mobile-chrome",
        "API contract runs once on the desktop project.",
      );

      const response = await request.get(`/api/athlete/${inactiveCode}/plans`);
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    });

    test("API-4: retired share code returns 404", async ({
      request,
    }, testInfo) => {
      test.skip(
        testInfo.project.name === "mobile-chrome",
        "API contract runs once on the desktop project.",
      );

      const response = await request.get(`/api/athlete/${retiredCode}/plans`);
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    });

    test("UI-1: panel renders newest plan header (name, phase, overview)", async ({
      page,
      request,
    }) => {
      const plan = await fetchPlan(request);

      const response = await page.goto(`/${planCode}`);
      expect(response?.status()).toBe(200);

      await expect(
        page.getByRole("heading", { name: plan.plan_name, exact: true }),
      ).toBeVisible();

      const planSection = page.locator("section").filter({
        has: page.getByRole("heading", { name: plan.plan_name, exact: true }),
      });
      await expect(planSection.getByText("Budujący", { exact: true })).toBeVisible();
      await expect(
        planSection.getByText(plan.plan_json.weeklyOverview, { exact: true }),
      ).toBeVisible();
      await expect(planSection.getByText(/Wygenerowano/i)).toBeVisible();

      if (olderPlanName) {
        await expect(page.getByText(olderPlanName)).toHaveCount(0);
      }
    });

    test("UI-2: week navigation switches rendered week", async ({
      page,
      request,
    }) => {
      const plan = await fetchPlan(request);
      const week1 = plan.plan_json.weeks.find((w) => w.weekNumber === 1);
      const week2 = plan.plan_json.weeks.find((w) => w.weekNumber === 2);
      expect(week1).toBeTruthy();
      expect(week2).toBeTruthy();

      const response = await page.goto(`/${planCode}`);
      expect(response?.status()).toBe(200);

      for (const n of [1, 2, 3, 4]) {
        await expect(
          page.getByRole("tab", { name: `Tydzień ${n}` }),
        ).toBeVisible();
      }
      await expect(
        page.getByRole("tab", { name: "Tydzień 1" }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        page.getByText(week1!.focus, { exact: true }),
      ).toBeVisible();

      await page.getByRole("tab", { name: "Tydzień 2" }).click();
      await expect(
        page.getByRole("tab", { name: "Tydzień 2" }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        page.getByText(week2!.focus, { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(week1!.focus, { exact: true })).toHaveCount(0);
    });

    test("UI-3: active code without a plan shows empty state", async ({
      page,
      request,
    }) => {
      const response = await page.goto(`/${emptyCode}`);
      expect(response?.status()).toBe(200);

      await expect(
        page.getByRole("heading", { name: "Plan treningowy", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Brak planu treningowego.", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("tab")).toHaveCount(0);

      const api = await request.get(`/api/athlete/${emptyCode}/plans`);
      expect(api.status()).toBe(200);
      expect(await api.json()).toEqual({ data: null });
    });

    test("UI-4: inactive code shows 404 page", async ({ page, request }) => {
      const response = await page.goto(`/${inactiveCode}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByText("404", { exact: true }).first()).toBeVisible();

      const api = await request.get(`/api/athlete/${inactiveCode}/plans`);
      expect(api.status()).toBe(404);
      expect(await api.json()).toEqual({ error: "Not found" });
    });

    test("UI-5: retired code shows 404 page", async ({ page, request }) => {
      const response = await page.goto(`/${retiredCode}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByText("404", { exact: true }).first()).toBeVisible();

      const api = await request.get(`/api/athlete/${retiredCode}/plans`);
      expect(api.status()).toBe(404);
      expect(await api.json()).toEqual({ error: "Not found" });
    });
  });
});
