import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { produceUsage, usageEnv } from "../helpers/model-usage";

// TestRail suite 2420, Model Usage section — the Model Usage page UI: chart
// toggle, filter bar, summary cards, detail table, error handling, and the
// tie-back from produced usage to what the page renders.
//
// Opt-in via E2E_AITRACE_ENDPOINT (uses the default-workspace usage produced
// through the e2e engine).

const env = usageEnv();
const e = env as NonNullable<typeof env>;

const RPC = "**/rpc/get_usage_by_dimension";
const EMPTY = "No usage in the selected window.";

/** Navigate to the Model Usage page for `workspace` and wait for first load. */
async function openModelUsage(page: Page, workspace: string): Promise<void> {
  await page.goto(`/#/${workspace}/model-usage`);
  await expect(page.getByText("Daily detail")).toBeVisible({ timeout: 20_000 });
  // Refresh is disabled while loading; wait for the first fetch to settle.
  await expect(page.getByRole("button", { name: "Refresh" })).toBeEnabled({
    timeout: 20_000,
  });
}

test.describe("model usage — page UI", () => {
  test.skip(!env, "set E2E_AITRACE_ENDPOINT to run Model Usage UI tests");

  test("trend chart defaults to line and toggles between line and bar", {
    tag: "@C2710853",
  }, async ({ page }) => {
    await openModelUsage(page, e.workspace);

    const line = page.getByRole("button", { name: "Line chart" });
    const bar = page.getByRole("button", { name: "Bar chart" });

    // The token total display is always present.
    await expect(page.getByText("total tokens")).toBeVisible();

    // Default: line selected (secondary variant), bar not.
    await expect(line).toHaveClass(/bg-secondary/);
    await expect(bar).not.toHaveClass(/bg-secondary/);

    // Toggle to bar, then back to line — the selection follows each click.
    await bar.click();
    await expect(bar).toHaveClass(/bg-secondary/);
    await expect(line).not.toHaveClass(/bg-secondary/);

    await line.click();
    await expect(line).toHaveClass(/bg-secondary/);
    await expect(page.getByText("total tokens")).toBeVisible();
  });

  test("detail table shows the 8 expected columns and typed rows", {
    tag: "@C2710855",
  }, async ({ page }) => {
    await openModelUsage(page, e.workspace);

    const detail = page
      .locator("div.border.rounded-md")
      .filter({ hasText: "Daily detail" });
    const headers = detail.locator("thead th");
    const expected = [
      "Date",
      "API key",
      "Type",
      "Endpoint",
      "Model",
      "Prompt",
      "Completion",
      "Total",
    ];
    await expect(headers).toHaveCount(expected.length);
    for (let i = 0; i < expected.length; i++) {
      await expect(headers.nth(i)).toHaveText(expected[i]);
    }

    // With default-workspace usage present, the body has typed rows: the Type
    // column is Internal/External/- and Prompt/Completion/Total are numbers.
    const rows = detail.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const firstRow = rows.first();
    await expect(firstRow.locator("td")).toHaveCount(8);
    // Date cell is a compact M/D value.
    await expect(firstRow.locator("td").first()).toHaveText(/^\d+\/\d+$/);
  });

  test("summary cards expose By API key and By model with the right columns", {
    tag: "@C2710854",
  }, async ({ page }) => {
    await openModelUsage(page, e.workspace);

    for (const [title, nameHeader] of [
      ["By API key", "API key"],
      ["By model", "Model"],
    ] as const) {
      // Scope by the card's exact header text; a plain substring would also
      // match the trend card's "Daily tokens by API key".
      const card = page
        .locator("div.border.rounded-md")
        .filter({ has: page.getByText(title, { exact: true }) });
      await expect(card.first()).toBeVisible();
      const headers = card.first().locator("thead th");
      await expect(headers).toHaveCount(4);
      await expect(headers.nth(0)).toHaveText(nameHeader);
      await expect(headers.nth(1)).toHaveText("Prompt");
      await expect(headers.nth(2)).toHaveText("Completion");
      await expect(headers.nth(3)).toHaveText("Total");
    }
  });

  test(
    "produced usage surfaces in the trend total, summary card and detail table",
    {
      tag: "@C2710851",
      annotation: { type: "slow", description: "produces a fresh usage row" },
    },
    async ({ page, apiHelper }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 150_000);
      const ts = Date.now();
      const keyName = `mu-spine-${ts}`;
      try {
        const { sk_value } = await apiHelper.createApiKey(keyName, {
          workspace: e.workspace,
        });
        // Admin can consume the internal e2e endpoint; produce a known row.
        const row = await produceUsage(apiHelper, e, sk_value, {
          completionTokens: 29,
          promptTokens: 3,
        });
        expect(row.usage).toBe(32);

        await openModelUsage(page, e.workspace);

        // The fresh key + endpoint appear in the detail table.
        const detail = page
          .locator("div.border.rounded-md")
          .filter({ hasText: "Daily detail" });
        await expect(detail.getByText(keyName).first()).toBeVisible({
          timeout: 15_000,
        });
        await expect(detail.getByText(e.endpoint).first()).toBeVisible();

        // The By API key summary card lists the fresh key.
        const byKey = page
          .locator("div.border.rounded-md")
          .filter({ has: page.getByText("By API key", { exact: true }) })
          .first();
        await expect(byKey.getByText(keyName).first()).toBeVisible();
      } finally {
        await apiHelper.deleteApiKey(keyName, { retries: 5 }).catch(() => {});
      }
    },
  );

  test("selecting a single API key auto-switches the chart to bar; clearing restores line", {
    tag: "@C2710857",
  }, async ({ page }) => {
    await openModelUsage(page, e.workspace);

    const line = page.getByRole("button", { name: "Line chart" });
    const bar = page.getByRole("button", { name: "Bar chart" });
    await expect(line).toHaveClass(/bg-secondary/);

    // The API key select is the first combobox in the filter bar (scoped so we
    // don't grab the top-bar workspace selector).
    const filterBar = page.locator(
      "div.flex.flex-wrap.items-center.gap-2.mb-4",
    );
    const apiKeySelect = filterBar.getByRole("combobox").first();

    // Open the dropdown and pick the first concrete key.
    await apiKeySelect.click();
    const concrete = page
      .getByRole("option")
      .filter({ hasNotText: "All API keys" })
      .first();
    await expect(concrete).toBeVisible();
    await concrete.click();

    // A single key auto-selects the bar chart.
    await expect(bar).toHaveClass(/bg-secondary/);
    await expect(line).not.toHaveClass(/bg-secondary/);

    // Clearing back to "All API keys" auto-restores the line chart.
    await apiKeySelect.click();
    await page.getByRole("option", { name: "All API keys" }).click();
    await expect(line).toHaveClass(/bg-secondary/);
  });

  test("a failed usage RPC shows an inline error and does not present stale data", {
    tag: "@C2710865",
  }, async ({ page }) => {
    // First load succeeds so there is data that must NOT survive a failure.
    await openModelUsage(page, e.workspace);

    // Force every subsequent usage RPC to fail.
    await page.route(RPC, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "injected failure" }),
      }),
    );
    await page.getByRole("button", { name: "Refresh" }).click();

    // An inline error is shown (not stale rows): the detail table falls back
    // to its empty state and the destructive error line appears.
    const detail = page
      .locator("div.border.rounded-md")
      .filter({ hasText: "Daily detail" });
    await expect(detail.getByText(EMPTY)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("div.text-destructive")).toBeVisible();

    // Recovery: once the RPC succeeds again, the error clears.
    await page.unroute(RPC);
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.locator("div.text-destructive")).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test(
    "the Type filter narrows the detail table to internal or external rows",
    {
      tag: "@C2710858",
      annotation: { type: "slow", description: "produces internal + external" },
    },
    async ({ page, apiHelper }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 200_000);
      const ts = Date.now();
      const intKey = `mu-int-${ts}`;
      const extKey = `mu-ext-${ts}`;
      const eeName = `mu-type-ee-${ts}`;
      try {
        const { sk_value: intSk } = await apiHelper.createApiKey(intKey, {
          workspace: e.workspace,
        });
        await produceUsage(apiHelper, e, intSk, { completionTokens: 5 });
        await apiHelper.createExternalEndpoint(
          eeName,
          `${e.gateway.replace(/:\d+$/, "")}:8000/${e.workspace}/${e.endpoint}/v1`,
          { any: "any" },
        );
        const { sk_value: extSk } = await apiHelper.createApiKey(extKey, {
          workspace: e.workspace,
        });
        await produceUsage(apiHelper, e, extSk, {
          completionTokens: 5,
          external: true,
          endpoint: eeName,
          match: (r) => r.endpoint_name === eeName,
          timeoutMs: 150_000,
        });

        await openModelUsage(page, e.workspace);
        const filterBar = page.locator(
          "div.flex.flex-wrap.items-center.gap-2.mb-4",
        );
        const typeSelect = filterBar.getByRole("combobox").nth(1);
        const detail = page
          .locator("div.border.rounded-md")
          .filter({ hasText: "Daily detail" });

        // Internal: the external endpoint row is hidden.
        await typeSelect.click();
        await page.getByRole("option", { name: "Internal" }).click();
        await expect(detail.getByText(eeName)).toHaveCount(0);
        await expect(detail.getByText("External", { exact: true })).toHaveCount(
          0,
        );

        // External: only the external endpoint row remains.
        await typeSelect.click();
        await page.getByRole("option", { name: "External" }).click();
        await expect(detail.getByText(eeName).first()).toBeVisible();
        await expect(detail.getByText("Internal", { exact: true })).toHaveCount(
          0,
        );
      } finally {
        await apiHelper
          .deleteExternalEndpoint(eeName, { force: true })
          .catch(() => {});
        await apiHelper.deleteApiKey(intKey, { retries: 5 }).catch(() => {});
        await apiHelper.deleteApiKey(extKey, { retries: 5 }).catch(() => {});
      }
    },
  );

  test(
    "the Model filter narrows rows by a case-insensitive substring",
    {
      tag: "@C2710859",
      annotation: { type: "slow", description: "produces qwen + llama usage" },
    },
    async ({ page, apiHelper }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 200_000);
      const ts = Date.now();
      const keyName = `mu-model-${ts}`;
      const qwen = `Qwen-mu-${ts}`;
      const llama = `llama-mu-${ts}`;
      try {
        const { sk_value } = await apiHelper.createApiKey(keyName, {
          workspace: e.workspace,
        });
        await produceUsage(apiHelper, e, sk_value, {
          completionTokens: 5,
          model: qwen,
        });
        await produceUsage(apiHelper, e, sk_value, {
          completionTokens: 7,
          model: llama,
        });

        await openModelUsage(page, e.workspace);
        const filterBar = page.locator(
          "div.flex.flex-wrap.items-center.gap-2.mb-4",
        );
        const modelInput = filterBar.getByPlaceholder("Model");
        const detail = page
          .locator("div.border.rounded-md")
          .filter({ hasText: "Daily detail" });

        // "qwen" substring keeps the Qwen row, drops llama.
        await modelInput.fill("qwen");
        await expect(detail.getByText(qwen).first()).toBeVisible();
        await expect(detail.getByText(llama)).toHaveCount(0);

        // Case-insensitive: "LLAMA" keeps llama, drops Qwen.
        await modelInput.fill("LLAMA");
        await expect(detail.getByText(llama).first()).toBeVisible();
        await expect(detail.getByText(qwen)).toHaveCount(0);

        // No match → empty state.
        await modelInput.fill(`zzz-none-${ts}`);
        await expect(detail.getByText(EMPTY)).toBeVisible();
      } finally {
        await apiHelper.deleteApiKey(keyName, { retries: 5 }).catch(() => {});
      }
    },
  );
});
