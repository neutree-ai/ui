import { expect, test } from "../fixtures/base";
import {
  errorCode,
  exhaustQuota,
  produceKeyUsage,
  waitGatewayReady,
} from "../helpers/access-quota";
import { usageEnv } from "../helpers/model-usage";

// TestRail suite 2420, Quota & Access Control — the API-key list + detail UI: the
// list Usage / Rate limits / Supported models / Status columns and their
// consistency with the summary RPC; inline Disable/Enable on the list and the
// detail page; the detail Limits card (fields + consumption bar + status); and
// editing limits (invalid values rejected, a valid smaller quota enforced).

const env = usageEnv();
const e = env as NonNullable<typeof env>;

function uid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test.describe("access & quota — list & detail UI", () => {
  test.skip(!env, "set E2E_AITRACE_ENDPOINT to run the UI tests");

  test("list columns and usage summary agree with the RPCs", {
    tag: "@C2727088",
  }, async ({ apiKeys, apiHelper }) => {
    test.setTimeout(150_000);
    const listName = `aq-list-${uid()}`;
    const bName = `aq-listb-${uid()}`;
    // Allow the model the e2e engine serves ("any") so the key can still infer
    // to produce usage while carrying an explicit allowlist for the UI.
    const model = "any";
    try {
      const list = await apiHelper.createApiKeyWithLimits(listName, {
        workspace: "default",
        limits: {
          token_quota: { limit: 100000, period: "daily" },
          rps: 5,
          allowed_models: [model],
        },
      });
      const b = await apiHelper.createApiKeyWithLimits(bName, {
        workspace: "default",
        limits: { token_quota: { limit: 50000, period: "daily" } },
      });
      await produceKeyUsage(apiHelper, e, list.sk_value, list.id);
      await produceKeyUsage(apiHelper, e, b.sk_value, b.id);
      // Settle the ledger, then read the summary once as the source of truth
      // (waitGatewayReady also spends tokens, so the exact used count isn't
      // predetermined — assert the RPCs agree with each other instead).
      await apiHelper.aggregateUsage();

      await apiKeys.goToList();
      const headers = apiKeys.table.root.locator("thead th");
      await expect(headers.filter({ hasText: /status/i })).toBeVisible();
      await expect(headers.filter({ hasText: /usage/i })).toBeVisible();
      await expect(headers.filter({ hasText: /rate limits/i })).toBeVisible();
      await expect(
        headers.filter({ hasText: /supported models/i }),
      ).toBeVisible();

      const row = apiKeys.table.rowWithText(listName);
      await expect(row.getByText("Active", { exact: true })).toBeVisible();
      await expect(row.getByText("5 RPS")).toBeVisible();
      await expect(row.getByText(model, { exact: true }).first()).toBeVisible();
      // Usage cell shows used / limit (contains a slash).
      await expect(row.getByText(/\/\s*100,000/)).toBeVisible();

      // Summary RPC is the source of truth for the used count.
      const summary = await apiHelper.getApiKeysUsageSummary("default");
      const rowList = summary.body.find((r) => r.api_key_id === list.id);
      expect(rowList?.token_limit).toBe(100000);
      expect(rowList?.used).toBeGreaterThan(0);
      const used = rowList!.used;
      expect(rowList?.remaining).toBe(100000 - used);
      // Both keys are present in the workspace summary.
      const ids = summary.body.map((r) => r.api_key_id);
      expect(ids).toContain(list.id);
      expect(ids).toContain(b.id);

      // The summary agrees with period-usage and with get_usage_by_dimension.
      const period = await apiHelper.apiKeyPeriodUsage(list.id, "daily");
      expect(Number(period.body)).toBe(used);
      const dim = await apiHelper.getUsageByDimension({
        start: new Date().toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
        workspace: "default",
        apiKeyId: list.id,
      });
      const dimSum = dim.body.reduce((s, r) => s + (r.usage ?? 0), 0);
      expect(dimSum).toBe(used);
    } finally {
      await apiHelper.deleteApiKey(listName, { retries: 5 }).catch(() => {});
      await apiHelper.deleteApiKey(bName, { retries: 5 }).catch(() => {});
    }
  });

  test("inline Disable/Enable on the list toggles status and preserves limits", {
    tag: "@C2727089",
  }, async ({ apiKeys, apiHelper }) => {
    test.setTimeout(120_000);
    const name = `aq-ld-${uid()}`;
    try {
      const key = await apiHelper.createApiKeyWithLimits(name, {
        workspace: "default",
        limits: { token_quota: { limit: 100000, period: "daily" }, rps: 5 },
      });
      // Baseline: the key can infer.
      await waitGatewayReady(e, key.sk_value, { workspace: "default" });

      await apiKeys.goToList();
      const row = apiKeys.table.rowWithText(name);
      await expect(row.getByText("Active", { exact: true })).toBeVisible();

      // Toggle via the row action menu, waiting for the menu to close so its
      // overlay does not intercept the next open.
      const toggle = async (item: "Disable" | "Enable") => {
        await row.locator('[data-testid="row-actions-trigger"]').click();
        const menuItem = apiKeys.page.getByRole("menuitem", { name: item });
        await menuItem.click();
        await expect(menuItem).toBeHidden();
      };

      await toggle("Disable");
      await expect(row.getByText("Disabled", { exact: true })).toBeVisible();
      expect((await apiHelper.getApiKeyLimits(key.id)).body?.disabled).toBe(
        true,
      );

      await toggle("Enable");
      await expect(row.getByText("Active", { exact: true })).toBeVisible();
      const limits = await apiHelper.getApiKeyLimits(key.id);
      // Enabling clears the `disabled` flag (removed, not set to false).
      expect(limits.body?.disabled).toBeFalsy();
      expect(limits.body?.token_quota?.limit).toBe(100000);

      // Inference recovers after re-enabling.
      await waitGatewayReady(e, key.sk_value, { workspace: "default" });
    } finally {
      await apiHelper.deleteApiKey(name, { retries: 5 }).catch(() => {});
    }
  });

  test("detail Limits card shows fields, consumption bar and status", {
    tag: "@C2727090",
  }, async ({ apiKeys, apiHelper }) => {
    test.setTimeout(150_000);
    const name = `aq-detail-${uid()}`;
    // Allow the served model ("any") so the key can infer to produce usage.
    const model = "any";
    try {
      const key = await apiHelper.createApiKeyWithLimits(name, {
        workspace: "default",
        limits: {
          token_quota: { limit: 100000, period: "monthly" },
          rps: 5,
          rpm: 100,
          concurrency: 10,
          allowed_models: [model],
        },
      });
      const used = await produceKeyUsage(apiHelper, e, key.sk_value, key.id, {
        period: "monthly",
      });

      await apiKeys.goToShow(name);
      const card = apiKeys.page.locator('[data-testid="show-page"]');
      await expect(card.getByText("Limits (optional)")).toBeVisible();
      await expect(card.getByText("Active", { exact: true })).toBeVisible();
      // Consumption bar line: used / limit tokens · remaining: N · Monthly
      await expect(card.getByText("Resource consumption")).toBeVisible();
      await expect(card.getByText(/\/\s*100,000\s*tokens/)).toBeVisible();
      // "Monthly" also appears in the edit form's period combobox — the
      // consumption line is the first match.
      await expect(card.getByText(/Monthly/).first()).toBeVisible();
      // Summary line reflects the rate limits.
      await expect(card.getByText(/5 RPS/)).toBeVisible();
      // Model access lists the allowed model.
      await expect(card.getByText("Model access")).toBeVisible();
      await expect(
        card.getByText(model, { exact: true }).first(),
      ).toBeVisible();

      // The progress "used" matches the period-usage RPC.
      const period = await apiHelper.apiKeyPeriodUsage(key.id, "monthly");
      expect(Number(period.body)).toBe(used);
    } finally {
      await apiHelper.deleteApiKey(name, { retries: 5 }).catch(() => {});
    }
  });

  test("Disable/Enable from the detail page toggles status and preserves limits", {
    tag: "@C2727091",
  }, async ({ apiKeys, apiHelper }) => {
    test.setTimeout(120_000);
    const name = `aq-dd-${uid()}`;
    try {
      const key = await apiHelper.createApiKeyWithLimits(name, {
        workspace: "default",
        limits: { token_quota: { limit: 100000, period: "daily" }, rps: 5 },
      });
      await waitGatewayReady(e, key.sk_value, { workspace: "default" });

      const card = apiKeys.page.locator('[data-testid="show-page"]');

      // Toggle via the card's "⋯" menu using the keyboard: pointer clicks race a
      // lingering Radix dismissable-layer overlay and the menu's open animation,
      // so focus the trigger and press Enter to open, then Enter to select the
      // single (Enable/Disable) item. Reload + wait-for-card-loaded first so the
      // card's load re-render can't detach the menu.
      const toggle = async () => {
        await apiKeys.goToShow(name);
        await expect(card.getByText(/5 RPS/)).toBeVisible();
        await card.locator('button[aria-label="Actions"]').focus();
        await apiKeys.page.keyboard.press("Enter");
        await apiKeys.page
          .getByRole("menuitem")
          .first()
          .waitFor({ state: "visible" });
        await apiKeys.page.keyboard.press("Enter");
      };

      await apiKeys.goToShow(name);
      await expect(card.getByText("Active", { exact: true })).toBeVisible();

      // Disable.
      await toggle();
      await expect(card.getByText("Disabled", { exact: true })).toBeVisible();
      expect((await apiHelper.getApiKeyLimits(key.id)).body?.disabled).toBe(
        true,
      );

      // Enable again — limits survive.
      await toggle();
      await expect(card.getByText("Active", { exact: true })).toBeVisible();
      const limits = await apiHelper.getApiKeyLimits(key.id);
      expect(limits.body?.disabled).toBeFalsy();
      expect(limits.body?.token_quota?.limit).toBe(100000);
      expect(limits.body?.rps).toBe(5);

      await waitGatewayReady(e, key.sk_value, { workspace: "default" });
    } finally {
      await apiHelper.deleteApiKey(name, { retries: 5 }).catch(() => {});
    }
  });

  test("editing limits: invalid values rejected, a smaller quota is enforced", {
    tag: "@C2727092",
  }, async ({ apiKeys, apiHelper }) => {
    test.setTimeout(180_000);
    const name = `aq-edit-${uid()}`;
    try {
      const key = await apiHelper.createApiKeyWithLimits(name, {
        workspace: "default",
        limits: {
          token_quota: { limit: 100000, period: "daily" },
          rps: 5,
          rpm: 60,
          concurrency: 4,
        },
      });
      await apiKeys.goToShow(name);
      const card = apiKeys.page.locator('[data-testid="show-page"]');
      const field = (f: string) =>
        card.locator(`[data-testid="field-${f}"] input`);
      const save = () => card.getByRole("button", { name: /^save$/i }).click();

      // Each numeric field rejects a non-positive value; the saved policy is
      // left unchanged.
      for (const { f, old } of [
        { f: "quota_limit", old: "100000" },
        { f: "rps", old: "5" },
        { f: "rpm", old: "60" },
        { f: "concurrency", old: "4" },
      ]) {
        await field(f).fill("0");
        await save();
        await expect(
          card.getByText("Must be a positive integer").first(),
        ).toBeVisible();
        const got = await apiHelper.getApiKeyLimits(key.id);
        expect(got.body?.token_quota?.limit).toBe(100000);
        expect(got.body?.rps).toBe(5);
        await field(f).fill(old);
      }

      // A valid, smaller quota saves and persists.
      await field("quota_limit").fill("300");
      await save();
      let persisted = false;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline && !persisted) {
        const got = await apiHelper.getApiKeyLimits(key.id);
        if (got.body?.token_quota?.limit === 300) persisted = true;
        else await new Promise((r) => setTimeout(r, 1500));
      }
      expect(persisted).toBe(true);
      const after = await apiHelper.getApiKeyLimits(key.id);
      expect(after.body?.rps).toBe(5);
      expect(after.body?.rpm).toBe(60);
      expect(after.body?.concurrency).toBe(4);

      // The new, smaller quota is enforced by the gateway.
      await waitGatewayReady(e, key.sk_value, {
        workspace: "default",
        completionTokens: 40,
        promptTokens: 10,
      });
      const rejected = await exhaustQuota(apiHelper, e, key.sk_value, {
        workspace: "default",
        completionTokens: 40,
        promptTokens: 10,
      });
      expect(errorCode(rejected.body)).toBe("quota_exceeded");
    } finally {
      await apiHelper.deleteApiKey(name, { retries: 5 }).catch(() => {});
    }
  });
});
