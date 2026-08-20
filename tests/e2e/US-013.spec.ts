import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

/**
 * US-013 - Progresje obciążeń (tracker z wykresem).
 *
 * Covers AC-1..AC-8 from backlog/stories/US-013-load-progressions.md:
 *  - AC-1: active tab + empty state
 *  - AC-2: create entry (exercise, date, kg, reps, sets, note) -> card + chart
 *  - AC-3: bar chart + history list (single bar with one entry)
 *  - AC-4: change badge (▲/▼/—) with two entries
 *  - AC-5: duplicate (athlete, exercise_name, date) -> 409 message, no overwrite
 *  - AC-6: inline edit with auto-save + survives a reload
 *  - AC-7: delete with confirmation
 *  - AC-8: form validation (submit disabled without exercise/weight)
 *  - AC-9: ownership - proven by SQL gates (tests/sql/us013-load-progressions-gates.sql,
 *    G11/G12 behavioral RLS checks); integration tests mock the client so
 *    RLS never executes there (not covered in E2E)
 *
 * Authenticated scenarios are skipped unless E2E_COACH_EMAIL +
 * E2E_COACH_PASSWORD are set.
 */

const coachEmail = process.env.E2E_COACH_EMAIL ?? "";
const coachPassword = process.env.E2E_COACH_PASSWORD ?? "";
const missingCoachCredentials = !coachEmail || !coachPassword;
const isCI = !!process.env.CI;

if (isCI && missingCoachCredentials) {
  throw new Error(
    "Missing E2E credentials in CI. Set E2E_COACH_EMAIL and E2E_COACH_PASSWORD.",
  );
}

interface ProgressionEntry {
  id: string;
  athlete_id: string;
  exercise_name: string;
  entry_date: string;
  weight_kg: number;
  reps: string | null;
  sets: string | null;
  note: string | null;
  source: string;
}

function dateNDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function loginAsCoach(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/Email/i).fill(coachEmail);
  await page.getByLabel(/Has/i).fill(coachPassword);
  await page.getByRole("button", { name: /Zaloguj/i }).click();
  await expect(page).toHaveURL(/\/(?:coach\/)?dashboard\/?$/, {
    timeout: 20_000,
  });
}

async function createAthlete(
  request: APIRequestContext,
  name: string,
): Promise<string> {
  const response = await request.post("/api/athletes", {
    data: { name },
  });
  if (response.status() !== 201) {
    throw new Error(`Unexpected create status: ${response.status()}`);
  }
  const body = (await response.json()) as { data: { id: string } };
  return body.data.id;
}

async function cleanupAthlete(
  request: APIRequestContext,
  athleteId: string,
): Promise<void> {
  const response = await request.delete(`/api/athletes/${athleteId}`);
  if (![204, 404].includes(response.status())) {
    throw new Error(
      `Unexpected cleanup status (${response.status()}) for athlete ${athleteId}`,
    );
  }
}

async function listEntries(
  request: APIRequestContext,
  athleteId: string,
): Promise<ProgressionEntry[]> {
  const response = await request.get(
    `/api/athletes/${athleteId}/progressions`,
  );
  if (response.status() !== 200) {
    throw new Error(
      `Unexpected progressions list status (${response.status()}) for athlete ${athleteId}`,
    );
  }
  const body = (await response.json()) as { data?: ProgressionEntry[] };
  return body.data ?? [];
}

async function waitForEntries(
  request: APIRequestContext,
  athleteId: string,
  predicate: (entries: ProgressionEntry[]) => boolean,
  timeoutMs = 15_000,
): Promise<ProgressionEntry[]> {
  const deadline = Date.now() + timeoutMs;
  let last: ProgressionEntry[] = [];

  while (Date.now() < deadline) {
    const entries = await listEntries(request, athleteId);
    last = entries;
    if (predicate(entries)) return entries;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for progressions predicate. Last snapshot: ${JSON.stringify(last)}`,
  );
}

async function openCreateForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Dodaj wpis$/i }).click();
}

async function submitCreateForm(page: Page): Promise<void> {
  await page
    .locator("form")
    .filter({ has: page.getByPlaceholder(/np\. Przysiad ze sztangą/i) })
    .getByRole("button", { name: /^Dodaj wpis$/i })
    .click();
}

test.describe("US-013 - load progressions", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    missingCoachCredentials,
    "Set E2E_COACH_EMAIL and E2E_COACH_PASSWORD to run authenticated E2E tests.",
  );

  test("coach creates, conflicts, charts, auto-save edits and deletes entries", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAsCoach(page);

    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const athleteName = `E2E US-013 Coach ${uniqueSuffix}`;
    let athleteId: string | null = null;

    try {
      athleteId = await createAthlete(page.request, athleteName);
      await page.goto(`/athletes/${athleteId}`);

      // AC-1: "Progresje" tab is active and shows the empty state.
      await page.getByRole("tab", { name: /Progresje/i }).click();
      await expect(
        page.getByRole("heading", { name: /Progresje obciążeń/i }),
      ).toBeVisible();
      await expect(page.getByText(/Brak śledzonych progresji/i)).toBeVisible();

      // AC-8: submit disabled without exercise name and invalid weight.
      await openCreateForm(page);
      const submit = page
        .locator("form")
        .filter({ has: page.getByPlaceholder(/np\. Przysiad ze sztangą/i) })
        .getByRole("button", { name: /^Dodaj wpis$/i });
      await expect(submit).toBeDisabled();

      await page.getByLabel(/Obciążenie \(kg\)/i).fill("0");
      await expect(
        page.getByText(/Obciążenie musi być liczbą od 0\.1 do 9999\.9 kg/i),
      ).toBeVisible();
      await expect(
        page.getByText(/Podaj nazwę ćwiczenia/i),
      ).toBeVisible();

      // AC-2: fill the form (default date = today) and submit.
      await page.getByLabel(/Nazwa ćwiczenia/i).fill("Przysiad ze sztanga");
      await page.getByLabel(/Obciążenie \(kg\)/i).fill("100");
      await page.getByLabel(/Powtórzenia/i).fill("6");
      await page.getByLabel(/Serie/i).fill("3");
      await page.getByLabel(/Notatka/i).fill("Ciezki dzien");
      await expect(submit).toBeEnabled();
      await submitCreateForm(page);

      // AC-3: card with chart (single bar) and history appears.
      const card = page
        .locator("article")
        .filter({ hasText: /Przysiad ze sztanga/i })
        .first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await expect(card.getByText(/1 wpis/)).toBeVisible();
      const chart = card.getByTestId("progression-chart");
      await expect(chart).toBeVisible();
      await expect(chart.locator("rect")).toHaveCount(1);

      const created = await waitForEntries(
        page.request,
        athleteId,
        (entries) =>
          entries.some(
            (e) =>
              e.exercise_name === "Przysiad ze sztanga" &&
              e.weight_kg === 100 &&
              e.reps === "6" &&
              e.sets === "3" &&
              e.note === "Ciezki dzien" &&
              e.source === "coach",
          ),
      );
      const createdEntry = created.find(
        (e) => e.exercise_name === "Przysiad ze sztanga",
      );
      expect(createdEntry).toBeTruthy();
      const createdEntryId = createdEntry?.id ?? "";
      expect(createdEntry?.entry_date).toBe(dateNDaysAgo(0));

      // AC-5: duplicate (exercise, date) -> 409 message, no overwrite.
      await openCreateForm(page);
      await page.getByLabel(/Nazwa ćwiczenia/i).fill("Przysiad ze sztanga");
      await page.getByLabel(/Obciążenie \(kg\)/i).fill("110");
      await submitCreateForm(page);
      await expect(
        page.getByText(/Wpis progresji dla tego ćwiczenia i dnia już istnieje/i),
      ).toBeVisible({ timeout: 10_000 });
      const afterConflict = await listEntries(page.request, athleteId);
      expect(afterConflict).toHaveLength(1);

      // AC-2/AC-4: second entry on a previous day with a lower weight ->
      // ascending chronology gives a positive delta -> ▲ badge + two bars.
      await openCreateForm(page);
      await page.getByLabel(/Nazwa ćwiczenia/i).fill("Przysiad ze sztanga");
      await page.getByLabel(/Data/i).fill(dateNDaysAgo(1));
      await page.getByLabel(/Obciążenie \(kg\)/i).fill("90");
      await submitCreateForm(page);

      await expect(
        page.getByText(/▲ 10 kg/i),
      ).toBeVisible({ timeout: 10_000 });
      await expect(chart.locator("rect")).toHaveCount(2);
      await expect(card.getByText(/2 wpisy/)).toBeVisible();

      const withTwo = await waitForEntries(
        page.request,
        athleteId,
        (entries) => entries.length === 2,
      );
      const previousEntry = withTwo.find(
        (e) =>
          e.exercise_name === "Przysiad ze sztanga" && e.weight_kg === 90,
      );
      expect(previousEntry).toBeTruthy();

      // AC-6: inline edit with auto-save; weight change survives a reload.
      await card.locator("button[aria-expanded]").click();
      const weightInput = page.locator(`#prog-weight-${createdEntryId}`);
      await weightInput.fill("115");
      await weightInput.blur();
      await expect(
        page.getByRole("status").filter({ hasText: /Zapisano/i }).first(),
      ).toBeVisible({ timeout: 10_000 });

      await waitForEntries(
        page.request,
        athleteId,
        (entries) =>
          entries.some(
            (e) =>
              e.id === createdEntry?.id && e.weight_kg === 115,
          ),
      );

      await page.reload();
      await page.getByRole("tab", { name: /Progresje/i }).click();
      await expect(
        page.getByText(/▲ 25 kg/i),
      ).toBeVisible({ timeout: 10_000 });

      // AC-6: date editing with auto-save; the change survives a reload.
      await card.locator("button[aria-expanded]").click();
      const dateInput = page.locator(`#prog-date-${previousEntry?.id}`);
      const targetDate = dateNDaysAgo(2);
      await dateInput.fill(targetDate);
      await dateInput.blur();
      await waitForEntries(
        page.request,
        athleteId,
        (entries) =>
          entries.some(
            (e) =>
              e.id === previousEntry?.id && e.entry_date === targetDate,
          ),
      );

      await page.reload();
      await page.getByRole("tab", { name: /Progresje/i }).click();
      await expect(card.getByText(/2 wpisy/)).toBeVisible();
      await card.locator("button[aria-expanded]").click();
      await expect(page.locator(`#prog-date-${previousEntry?.id}`)).toHaveValue(
        targetDate,
      );

      // AC-7: delete with confirmation.
      page.once("dialog", async (dialog) => {
        expect(dialog.type()).toBe("confirm");
        await dialog.accept();
      });
      const deletePreviousRow = card
        .locator("li")
        .filter({ has: page.locator(`#prog-date-${previousEntry?.id}`) })
        .getByRole("button", { name: /Usuń/i });
      await deletePreviousRow.click();

      await waitForEntries(
        page.request,
        athleteId,
        (entries) => entries.length === 1,
      );
      await expect(card.getByText(/1 wpis/)).toBeVisible();

      page.once("dialog", async (dialog) => {
        expect(dialog.type()).toBe("confirm");
        await dialog.accept();
      });
      await card.getByRole("button", { name: /Usuń/i }).first().click();

      await waitForEntries(
        page.request,
        athleteId,
        (entries) => entries.length === 0,
      );
      await expect(page.getByText(/Brak śledzonych progresji/i)).toBeVisible();
    } finally {
      if (athleteId) {
        await page.goto("/dashboard");
        await cleanupAthlete(page.request, athleteId);
      }
    }
  });

  test("mobile: create flow with datalist suggestion works on Pixel 7", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
    });
    const page = await context.newPage();
    let athleteId: string | null = null;

    try {
      await loginAsCoach(page);
      const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
      const athleteName = `E2E US-013 Mobile ${uniqueSuffix}`;
      athleteId = await createAthlete(page.request, athleteName);
      await page.goto(`/athletes/${athleteId}`);

      await page.getByRole("tab", { name: /Progresje/i }).click();
      await openCreateForm(page);
      await page.getByLabel(/Nazwa ćwiczenia/i).fill("Martwy ciag");
      await page.getByLabel(/Obciążenie \(kg\)/i).fill("120");
      await submitCreateForm(page);

      const card = page
        .locator("article")
        .filter({ hasText: /Martwy ciag/i })
        .first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await expect(card.getByTestId("progression-chart").locator("rect")).toHaveCount(1);

      // Datalist offers the existing exercise as a suggestion.
      await openCreateForm(page);
      await expect(
        page.locator('datalist option[value="Martwy ciag"]'),
      ).toBeVisible();
    } finally {
      if (athleteId) {
        await page.goto("/dashboard");
        await cleanupAthlete(page.request, athleteId);
      }
      await context.close();
    }
  });
});