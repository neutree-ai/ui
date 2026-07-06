import type { Locator } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import {
  burst,
  errorCode,
  infer,
  waitForReject,
  waitGatewayReady,
} from "../helpers/access-quota";
import { engineHost, usageEnv } from "../helpers/model-usage";
import type { ResourcePage } from "../helpers/resource-page";

// TestRail suite 2420, Quota & Access Control — API-key creation with a limits
// section: full-field save + yearly period, illegal-value rejection, the
// omit-limits "unlimited" path, the allowed-models source + enforcement, and
// the create -> infer -> list-usage main line.

const env = usageEnv();
const e = env as NonNullable<typeof env>;

function uid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Open the create dialog on the api-keys list, select the workspace, name it. */
async function openCreate(
  apiKeys: ResourcePage,
  name: string,
): Promise<Locator> {
  await apiKeys.goToList();
  await apiKeys.page.getByRole("link", { name: /create/i }).click();
  const dialog = apiKeys.page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  // Scope to the workspace field — the limits section also has a "Select a
  // model" button that would otherwise match a bare /select/i filter.
  await dialog
    .locator('[data-testid="field-workspace"]')
    .getByRole("combobox")
    .click();
  await apiKeys.page
    .locator('[data-state="open"][role="dialog"]')
    .getByRole("option", { name: "default", exact: true })
    .click();
  await dialog.getByRole("textbox", { name: /name/i }).fill(name);
  return dialog;
}

/** Fill a numeric limits field by its FormFieldGroup test id. */
async function fillLimit(dialog: Locator, field: string, value: string) {
  await dialog.locator(`[data-testid="field-${field}"] input`).fill(value);
}

test.describe("access & quota — create form", () => {
  test("limits fields save; yearly period round-trips", {
    tag: "@C2727084",
  }, async ({ apiKeys, apiHelper }) => {
    test.setTimeout(90_000);
    const monthlyName = `aq-cm-${uid()}`;
    const yearlyName = `aq-cy-${uid()}`;
    try {
      // Monthly key with every numeric field.
      let dialog = await openCreate(apiKeys, monthlyName);
      await fillLimit(dialog, "quota_limit", "100000");
      await fillLimit(dialog, "rps", "5");
      await fillLimit(dialog, "rpm", "100");
      await fillLimit(dialog, "concurrency", "10");
      await dialog.getByRole("button", { name: /^create$/i }).click();
      await expect(
        dialog.getByText("API Key created successfully", { exact: false }),
      ).toBeVisible({ timeout: 15_000 });
      await dialog.getByRole("button", { name: /close/i }).first().click();

      const monthlyId = await apiHelper.getApiKeyId(monthlyName);
      const m = await apiHelper.getApiKeyLimits(monthlyId);
      expect(m.body?.token_quota?.period).toBe("monthly");
      expect(m.body?.token_quota?.limit).toBe(100000);
      expect(m.body?.rps).toBe(5);
      expect(m.body?.rpm).toBe(100);
      expect(m.body?.concurrency).toBe(10);

      // Yearly key: switch the period combobox.
      dialog = await openCreate(apiKeys, yearlyName);
      await fillLimit(dialog, "quota_limit", "200000");
      await dialog
        .locator('[data-testid="field-quota_period"]')
        .getByRole("combobox")
        .click();
      await apiKeys.page
        .getByRole("option", { name: "Yearly", exact: true })
        .click();
      await dialog.getByRole("button", { name: /^create$/i }).click();
      await expect(
        dialog.getByText("API Key created successfully", { exact: false }),
      ).toBeVisible({ timeout: 15_000 });
      await dialog.getByRole("button", { name: /close/i }).first().click();

      const yearlyId = await apiHelper.getApiKeyId(yearlyName);
      const y = await apiHelper.getApiKeyLimits(yearlyId);
      expect(y.body?.token_quota?.period).toBe("yearly");
      expect(y.body?.token_quota?.limit).toBe(200000);

      // The list usage summary reports the yearly limit.
      const summary = await apiHelper.getApiKeysUsageSummary("default");
      const row = summary.body.find((r) => r.api_key_id === yearlyId);
      expect(row?.token_limit).toBe(200000);
    } finally {
      await apiHelper.deleteApiKey(monthlyName, { retries: 5 }).catch(() => {});
      await apiHelper.deleteApiKey(yearlyName, { retries: 5 }).catch(() => {});
    }
  });

  test("illegal numeric limits are rejected and create no key", {
    tag: "@C2727086",
  }, async ({ apiHelper }) => {
    test.setTimeout(60_000);
    const name = `aq-inv-${uid()}`;
    const attempt = async (limits: Record<string, unknown>) => {
      const r = await apiHelper.request(
        "POST",
        "/rpc/create_api_key",
        { p_workspace: "default", p_name: name, p_quota: 0, p_limits: limits },
        { probe: true },
      );
      expect(r.status).toBeGreaterThanOrEqual(400);
      // No key was created.
      expect(await apiHelper.getApiKeyId(name)).toBe("");
    };
    try {
      await attempt({ token_quota: { limit: 0, period: "daily" } });
      await attempt({ token_quota: { limit: -1, period: "daily" } });
      await attempt({ rps: 0 });
      await attempt({ rpm: -1 });
      await attempt({ concurrency: 0 });

      // A valid set now succeeds and persists exactly.
      const { id } = await apiHelper.createApiKeyWithLimits(name, {
        workspace: "default",
        limits: {
          token_quota: { limit: 5000, period: "daily" },
          rps: 3,
          rpm: 60,
          concurrency: 4,
        },
      });
      const got = await apiHelper.getApiKeyLimits(id);
      expect(got.body?.token_quota?.limit).toBe(5000);
      expect(got.body?.rps).toBe(3);
      expect(got.body?.rpm).toBe(60);
      expect(got.body?.concurrency).toBe(4);
    } finally {
      await apiHelper.deleteApiKey(name, { retries: 5 }).catch(() => {});
    }
  });
});

test.describe("access & quota — create + gateway", () => {
  test.skip(!env, "set E2E_AITRACE_ENDPOINT to run create+gateway tests");

  test("omitting the limits section yields an unlimited key", {
    tag: "@C2727087",
  }, async ({ apiHelper }) => {
    test.setTimeout(90_000);
    const name = `aq-unl-${uid()}`;
    try {
      const { id, sk_value } = await apiHelper.createApiKeyWithLimits(name, {
        workspace: e.workspace,
      });
      // No limits policy at all.
      const limits = await apiHelper.getApiKeyLimits(id);
      expect(limits.status).toBe(200);
      expect(limits.body?.token_quota).toBeUndefined();
      expect(limits.body?.rps).toBeUndefined();
      expect(limits.body?.disabled).toBeFalsy();

      // Five rapid inferences all succeed (no rate limit).
      await waitGatewayReady(e, sk_value, { workspace: e.workspace });
      const results = await burst(e, sk_value, 5, { workspace: e.workspace });
      expect(results.every((r) => r.status === 200)).toBe(true);
      const again = await infer(e, sk_value, { workspace: e.workspace });
      expect(again.status).toBe(200);

      // An unlimited key carries no token quota → absent from the usage summary.
      const summary = await apiHelper.getApiKeysUsageSummary(e.workspace);
      expect(summary.body.find((r) => r.api_key_id === id)).toBeUndefined();
    } finally {
      await apiHelper.deleteApiKey(name, { retries: 5 }).catch(() => {});
    }
  });

  test("allowed-models list is sourced from workspace models and enforced", {
    tag: "@C2727085",
  }, async ({ apiHelper }) => {
    test.setTimeout(120_000);
    const allow = `aq-allow-${uid()}`;
    const deny = `aq-deny-${uid()}`;
    const epName = `aq-ee-${uid()}`;
    const keyName = `aq-mdl-${uid()}`;
    try {
      const upstream = `${engineHost(e)}:8000/${e.workspace}/${e.endpoint}/v1`;
      await apiHelper.createExternalEndpoint(
        epName,
        upstream,
        { [allow]: "any", [deny]: "any" },
        { workspace: e.workspace },
      );

      // The dropdown source RPC surfaces both models in the workspace.
      const models = await apiHelper.getWorkspaceModels(e.workspace);
      const names = models.body.map((m) => m.model);
      expect(names).toContain(allow);
      expect(names).toContain(deny);

      // Create a key allowing only one of them.
      const { id, sk_value } = await apiHelper.createApiKeyWithLimits(keyName, {
        workspace: e.workspace,
        limits: { allowed_models: [allow] },
      });
      expect(
        (await apiHelper.getApiKeyLimits(id)).body?.allowed_models,
      ).toEqual([allow]);

      // Allowed model succeeds; disallowed model is rejected.
      await waitGatewayReady(e, sk_value, {
        workspace: e.workspace,
        external: true,
        endpoint: epName,
        model: allow,
      });
      const denied = await waitForReject(
        e,
        sk_value,
        { status: 403, code: "model_not_permitted" },
        {
          workspace: e.workspace,
          external: true,
          endpoint: epName,
          model: deny,
        },
      );
      expect(errorCode(denied.body)).toBe("model_not_permitted");
    } finally {
      await apiHelper.deleteApiKey(keyName, { retries: 5 }).catch(() => {});
      await apiHelper
        .deleteExternalEndpoint(epName, { retries: 5 })
        .catch(() => {});
    }
  });

  test("main line: create with quota + RPS, infer, list usage is correct", {
    tag: "@C2727083",
  }, async ({ apiKeys, apiHelper }) => {
    test.setTimeout(120_000);
    const name = `aq-spine-${uid()}`;
    try {
      // Create through the dialog with a daily quota + RPS.
      const dialog = await openCreate(apiKeys, name);
      await dialog
        .locator('[data-testid="field-quota_limit"] input')
        .fill("100000");
      await dialog
        .locator('[data-testid="field-quota_period"]')
        .getByRole("combobox")
        .click();
      await apiKeys.page
        .getByRole("option", { name: "Daily", exact: true })
        .click();
      await dialog.locator('[data-testid="field-rps"] input').fill("10");
      await dialog.getByRole("button", { name: /^create$/i }).click();
      await expect(
        dialog.getByText("API Key created successfully", { exact: false }),
      ).toBeVisible({ timeout: 15_000 });
      const sk = (await dialog.locator("code").first().textContent()) ?? "";
      await dialog.getByRole("button", { name: /close/i }).first().click();

      const id = await apiHelper.getApiKeyId(name);
      expect((await apiHelper.getApiKeyLimits(id)).body?.rps).toBe(10);

      // Infer, then wait for the aggregated usage to surface.
      await waitGatewayReady(e, sk, {
        workspace: e.workspace,
        completionTokens: 40,
        promptTokens: 10,
      });
      await infer(e, sk, {
        workspace: e.workspace,
        completionTokens: 40,
        promptTokens: 10,
      });
      let used = 0;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline && used <= 0) {
        await apiHelper.aggregateUsage();
        const p = await apiHelper.apiKeyPeriodUsage(id, "daily");
        used = Number(p.body ?? 0);
        if (used <= 0) await new Promise((r) => setTimeout(r, 4000));
      }
      expect(used).toBeGreaterThan(0);

      // Summary RPC: used > 0, limit = 100000, remaining = limit - used.
      const summary = await apiHelper.getApiKeysUsageSummary("default");
      const row = summary.body.find((r) => r.api_key_id === id);
      expect(row?.token_limit).toBe(100000);
      expect(row?.used).toBeGreaterThan(0);
      expect(row?.remaining).toBe(row!.token_limit - row!.used);
      // The summary RPC is exactly what the list Usage column renders; its
      // visual cell is covered by the dedicated list test (@C2727088).
    } finally {
      await apiHelper.deleteApiKey(name, { retries: 5 }).catch(() => {});
    }
  });
});
