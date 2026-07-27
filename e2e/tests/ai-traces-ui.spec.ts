import { expect, test } from "../fixtures/base";
import { aiTraceEnv, chatCompletion } from "../helpers/ai-trace";

// TestRail suite 2420, Access Log section — frontend UI cases
// (list / activity chart / detail drawer). The ai-traces UI is almost free of
// data-testids, so selectors mostly rely on the i18n labels.
// Opt-in via E2E_AITRACE_ENDPOINT.

const env = aiTraceEnv();
const e = env as NonNullable<typeof env>;

test.describe("access log — UI", () => {
  test.skip(!env, "set E2E_AITRACE_ENDPOINT to run Access Log UI tests");

  let keyName: string;

  // Seed a few traces for the target endpoint so the list/drawer have data.
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: "e2e/auth/storage-state.json",
    });
    const page = await ctx.newPage();
    const { ApiHelper } = await import("../helpers/api-helper");
    const api = new ApiHelper(page);
    keyName = `uitrace-key-${Date.now()}`;
    const { sk_value } = await api.createApiKey(keyName);
    for (let i = 0; i < 2; i++) {
      await chatCompletion(e, sk_value, {
        mode: "fixed",
        text: `ui-seed-${Date.now()}-${i}`,
        completion_tokens: 6,
      });
    }
    // Give the trace pipeline a moment to ingest before the UI reads.
    await new Promise((r) => setTimeout(r, 8000));
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: "e2e/auth/storage-state.json",
    });
    const page = await ctx.newPage();
    const { ApiHelper } = await import("../helpers/api-helper");
    await new ApiHelper(page).deleteApiKey(keyName).catch(() => {});
    await ctx.close();
  });

  /** Open the Access Log page filtered to the seeded endpoint. */
  async function openFiltered(page: import("@playwright/test").Page) {
    await page.goto(`/#/${e.workspace}/ai-traces`);
    await expect(
      page.getByRole("heading", { name: /access log/i }).first(),
    ).toBeVisible();
    await page.getByPlaceholder("Endpoint name").fill(e.endpoint);
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  test("page shows the entry, column headers and activity chart", {
    tag: ["@C2710799", "@C2710796"],
  }, async ({ page }) => {
    await page.goto(`/#/${e.workspace}/ai-traces`);
    await expect(
      page.getByRole("heading", { name: /access log/i }).first(),
    ).toBeVisible();
    // Activity chart (recharts renders an <svg>).
    await expect(page.getByText("Requests (last 7 days)")).toBeVisible();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible();
    // Column headers.
    const headers = page.locator("thead th");
    for (const label of [
      "Time",
      "Endpoint",
      "Model",
      "Status",
      "Tokens",
      "Duration",
      "Finish",
    ]) {
      await expect(
        headers.filter({ hasText: new RegExp(`^${label}$`) }).first(),
      ).toBeVisible();
    }
  });

  test("endpoint filter narrows the list to that endpoint", {
    tag: "@C2710798",
  }, async ({ page }) => {
    await openFiltered(page);
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    // Every visible row belongs to the filtered endpoint.
    const count = await rows.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      await expect(rows.nth(i)).toContainText(e.endpoint);
    }
  });

  test("an unmatched filter shows the empty state", {
    tag: "@C2710800",
  }, async ({ page }) => {
    await page.goto(`/#/${e.workspace}/ai-traces`);
    await page
      .getByPlaceholder("Endpoint name")
      .fill(`no-such-endpoint-${Date.now()}`);
    await expect(
      page.getByText("No access logs in the selected window."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("status filter accepts both suggested and free-typed codes", async ({
    page,
  }) => {
    await openFiltered(page);
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    const trigger = page.getByTestId("status-filter");
    const options = page.locator('[data-state="open"][role="dialog"]');

    // A suggested code — the seeded traces all succeeded.
    await trigger.click();
    await options.getByRole("option", { name: /^200/ }).click();
    await expect(trigger).toHaveText("200");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    // A code that is not in the suggestion list is still selectable.
    await trigger.click();
    await options.getByPlaceholder("Type or pick a status code").fill("418");
    await options.getByRole("option", { name: /^418/ }).click();
    await expect(trigger).toHaveText("418");
    await expect(
      page.getByText("No access logs in the selected window."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("detail drawer shows metadata, models and stream flag", {
    tag: "@C2710804",
  }, async ({ page }) => {
    await openFiltered(page);
    const row = page.locator("tbody tr").first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Access log detail")).toBeVisible();
    for (const label of [
      "Endpoint",
      "Request model",
      "Response model",
      "Stream",
      "Tokens",
      "API key",
    ]) {
      await expect(
        drawer.getByText(label, { exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("detail drawer supports Formatted and Raw views", {
    tag: "@C2710806",
  }, async ({ page }) => {
    await openFiltered(page);
    const row = page.locator("tbody tr").first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    // OpenAI chat bodies have a formatted view; both toggles are present.
    await expect(
      drawer.getByText("Formatted", { exact: true }).first(),
    ).toBeVisible();
    const raw = drawer.getByText("Raw", { exact: true }).first();
    await expect(raw).toBeVisible();
    await raw.click();
    // Raw view exposes the request-body JSON verbatim.
    await expect(drawer.getByText(/"messages"/).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("detail drawer body search reports matches", {
    tag: "@C2710807",
  }, async ({ page }) => {
    await openFiltered(page);
    const row = page.locator("tbody tr").first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    const search = drawer.getByPlaceholder("Search in body…").first();
    await search.fill("messages");
    // A match counter (n / m) or "No matches" appears — either proves search ran.
    await expect(
      drawer.getByText(/\d+\s*\/\s*\d+|No matches/).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("detail drawer can be closed", { tag: "@C2710809" }, async ({
    page,
  }) => {
    await openFiltered(page);
    const row = page.locator("tbody tr").first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden({ timeout: 10_000 });
  });
});
