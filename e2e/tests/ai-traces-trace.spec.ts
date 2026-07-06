import { expect, test } from "../fixtures/base";
import { aiTraceEnv, chatCompletion, waitForTrace } from "../helpers/ai-trace";
import { ApiHelper } from "../helpers/api-helper";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";

// TestRail suite 2420, Access Log section — trace-data-dependent cases.
//
// These require a Running e2e-engine endpoint (neutree-e2e-engine) whose
// programmable output makes token counts / finish_reason / body deterministic.
// Opt-in, like the GPU recipe spec:
//   E2E_AITRACE_ENDPOINT=<endpoint name>   (Running, workspace `default`)
//   E2E_AITRACE_GATEWAY=<AI gateway base>  (default: BASE_URL host on :80)
//
// A request driven through the gateway flows Kong -> vector -> VictoriaLogs and
// surfaces via GET /api/v1/ai-traces/... and the Access Log UI.

const env = aiTraceEnv();

/** Trace ingestion (Kong -> vector -> VictoriaLogs) is async; polls needed. */
const TRACE_WAIT = 60_000;

test.describe("access log — traces", () => {
  test.skip(
    !env,
    "set E2E_AITRACE_ENDPOINT to a Running e2e-engine endpoint to run trace tests",
  );

  test(
    "inference produces a trace visible in the read API and Access Log UI",
    { tag: "@C2710795" },
    async ({ apiHelper, page }, testInfo) => {
      testInfo.setTimeout(3 * 60_000);
      const e = env as NonNullable<typeof env>;
      const keyName = `trace-key-${Date.now()}`;
      const { sk_value } = await apiHelper.createApiKey(keyName);

      try {
        // Drive a fully-controlled non-streaming completion. A per-run unique
        // completion_tokens count makes THIS trace unambiguous in the list.
        const nonce = `access-log-${Date.now()}`;
        const ctok = 100 + (Date.now() % 800);
        const gw = await chatCompletion(e, sk_value, {
          mode: "fixed",
          text: nonce,
          prompt_tokens: 3,
          completion_tokens: ctok,
          finish_reason: "stop",
        });
        expect(gw.status).toBe(200);

        // Wait for the trace to land and match the exact controlled shape.
        const item = await waitForTrace(
          apiHelper,
          e.workspace,
          (it) =>
            it.endpoint_name === e.endpoint &&
            it.response_status === 200 &&
            it.completion_tokens === ctok &&
            it.finish_reason === "stop",
          { timeoutMs: TRACE_WAIT },
        );

        // List-row metrics (Time/Endpoint/Model/Status/Tokens/Finish columns).
        expect(item.endpoint_type).toBe("endpoint");
        expect(item.endpoint_name).toBe(e.endpoint);
        expect(item.prompt_tokens).toBe(3);
        expect(item.total_tokens).toBe(3 + ctok);
        expect(item.stream).toBe(false);
        expect(typeof item.duration_ms).toBe("number");
        expect(item.time).toBeTruthy();

        // Detail drawer content: request messages + response body echo back.
        const detail = await apiHelper.getAITrace(
          e.workspace,
          String(item.request_id),
        );
        expect(detail.status).toBe(200);
        const d = detail.body as Record<string, unknown>;
        expect(String(d.request_body)).toContain(nonce);
        expect(String(d.response_body)).toContain(nonce);

        // Stats endpoint returns a per-day series covering today.
        const stats = await apiHelper.getAITraceStats(e.workspace, { days: 7 });
        expect(stats.status).toBe(200);
        expect(Array.isArray((stats.body as { days?: unknown[] }).days)).toBe(
          true,
        );

        // UI: the Access Log page loads, the trace is findable by endpoint,
        // and its detail drawer shows the response content.
        await page.goto(`/#/${e.workspace}/ai-traces`);
        await expect(
          page.getByRole("heading", { name: /access log/i }).first(),
        ).toBeVisible();
        const endpointFilter = page.getByPlaceholder(/endpoint/i).first();
        await endpointFilter.fill(e.endpoint);
        await page.waitForLoadState("networkidle").catch(() => {});
        const row = page
          .locator("tbody tr")
          .filter({ hasText: e.endpoint })
          .first();
        await expect(row).toBeVisible({ timeout: 15_000 });
        await row.click();
        // Detail drawer opens and renders the trace metadata (exact request /
        // response bodies are asserted authoritatively via the API above).
        const drawer = page.getByRole("dialog");
        await expect(drawer).toBeVisible();
        await expect(
          drawer.getByText(e.endpoint, { exact: false }).first(),
        ).toBeVisible({ timeout: 15_000 });
      } finally {
        await apiHelper.deleteApiKey(keyName).catch(() => {});
      }
    },
  );

  test(
    "user with workspace:read + endpoint:trace-read can read traces",
    {
      tag: "@C2710831",
      annotation: {
        type: "slow",
        description: "creates a scoped test user and reads the trace API",
      },
    },
    async ({ apiHelper, createTestUser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 60_000);
      const e = env as NonNullable<typeof env>;

      // Seed a trace so the workspace is non-empty.
      const keyName = `trace-key-${Date.now()}`;
      const { sk_value } = await apiHelper.createApiKey(keyName);
      try {
        await chatCompletion(e, sk_value, {
          mode: "fixed",
          text: `rbac-${Date.now()}`,
          completion_tokens: 5,
        });

        // A user holding the baseline workspace:read plus a trace-read grant
        // can call the read API and open the page.
        const authorized = await createTestUser([
          "workspace:read",
          "endpoint:trace-read",
          "external_endpoint:trace-read",
        ]);
        const authApi = new ApiHelper(authorized.page);
        const okList = await authApi.listAITraces(e.workspace, { limit: 10 });
        expect(okList.status).toBe(200);
        const okStats = await authApi.getAITraceStats(e.workspace, { days: 7 });
        expect(okStats.status).toBe(200);

        await authorized.page.goto(`/#/${e.workspace}/ai-traces`);
        await expect(
          authorized.page.getByRole("heading", { name: /access log/i }).first(),
        ).toBeVisible();
      } finally {
        await apiHelper.deleteApiKey(keyName).catch(() => {});
      }
    },
  );
});
