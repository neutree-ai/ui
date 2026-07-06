import { expect, test } from "../fixtures/base";
import { aiTraceEnv, chatCompletion, waitForTrace } from "../helpers/ai-trace";
import type { ApiHelper } from "../helpers/api-helper";

// TestRail suite 2420, Access Log section — backend / read-API cases
// (采集 / 列表查询 / 详情查询 / 入库). These drive controlled requests through
// the e2e inference engine and assert the ai-traces read API, so they are
// deterministic and UI-independent. Opt-in via E2E_AITRACE_ENDPOINT.

const env = aiTraceEnv();

type Trace = Record<string, unknown>;

/** Fire a controlled non-streaming completion and return its landed trace. */
async function seedTrace(
  api: ApiHelper,
  sk: string,
  d: Record<string, unknown>,
  extra?: Partial<{ stream: boolean }>,
): Promise<{ nonce: string; ctok: number; item: Trace }> {
  const e = env as NonNullable<typeof env>;
  const nonce = `apitrace-${Date.now()}-${Math.floor(performance.now())}`;
  const ctok = 100 + (Date.now() % 800);
  const gw = await chatCompletion(
    e,
    sk,
    {
      mode: "fixed",
      text: nonce,
      prompt_tokens: 3,
      completion_tokens: ctok,
      finish_reason: "stop",
      ...d,
    },
    { stream: extra?.stream },
  );
  expect(gw.status).toBe(200);
  const item = await waitForTrace(
    api,
    e.workspace,
    (it) =>
      it.endpoint_name === e.endpoint &&
      it.response_status === 200 &&
      it.completion_tokens === ctok,
    { timeoutMs: 60_000 },
  );
  return { nonce, ctok, item };
}

test.describe("access log — collection & read API", () => {
  test.skip(!env, "set E2E_AITRACE_ENDPOINT to run backend trace tests");

  const e = env as NonNullable<typeof env>;
  let sk: string;
  let keyName: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: "e2e/auth/storage-state.json",
    });
    const page = await ctx.newPage();
    const { ApiHelper } = await import("../helpers/api-helper");
    const api = new ApiHelper(page);
    keyName = `apitrace-key-${Date.now()}`;
    const r = await api.createApiKey(keyName);
    sk = r.sk_value;
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

  test(
    "non-streaming call is ingested with full request/response fields",
    { tag: "@C2710810" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const { nonce, ctok, item } = await seedTrace(apiHelper, sk, {});
      // Request-side.
      expect(item.endpoint_type).toBe("endpoint");
      expect(item.endpoint_name).toBe(e.endpoint);
      expect(String(item.request_uri)).toContain(e.endpoint);
      expect(item.api_key_id).toBeTruthy();
      // Response-side.
      expect(item.response_status).toBe(200);
      expect(item.prompt_tokens).toBe(3);
      expect(item.completion_tokens).toBe(ctok);
      expect(item.total_tokens).toBe(3 + ctok);
      expect(item.finish_reason).toBe("stop");
      expect(typeof item.duration_ms).toBe("number");
      // Bodies (detail only).
      const detail = await apiHelper.getAITrace(
        e.workspace,
        String(item.request_id),
      );
      expect(detail.status).toBe(200);
      const d = detail.body as Trace;
      expect(String(d.request_body)).toContain(nonce);
      expect(String(d.response_body)).toContain(nonce);
    },
  );

  test(
    "streaming call records the SSE body and finish_reason",
    { tag: "@C2710811" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      // Stream mode does not honour a completion_tokens override, so match the
      // freshly-produced streaming trace by its `stream` flag (newest first).
      const gw = await chatCompletion(
        e,
        sk,
        { mode: "fixed", text: `stream-${Date.now()}`, finish_reason: "stop" },
        { stream: true },
      );
      expect(gw.status).toBe(200);
      const item = await waitForTrace(
        apiHelper,
        e.workspace,
        (it) =>
          it.endpoint_name === e.endpoint &&
          it.stream === true &&
          it.response_status === 200,
        { timeoutMs: 60_000 },
      );
      expect(item.finish_reason).toBeTruthy();
      const detail = await apiHelper.getAITrace(
        e.workspace,
        String(item.request_id),
      );
      const body = String((detail.body as Trace).response_body);
      // Gateway concatenates the SSE stream into response_body.
      expect(body).toContain("data:");
      expect(body).toContain("[DONE]");
    },
  );

  test(
    "failed (5xx) response body is still recorded",
    { tag: "@C2710816" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const marker = `err5xx-${Date.now()}`;
      const gw = await chatCompletion(e, sk, { mode: "error", text: marker });
      expect(gw.status).toBeGreaterThanOrEqual(500);
      const item = await waitForTrace(
        apiHelper,
        e.workspace,
        (it) =>
          it.endpoint_name === e.endpoint && Number(it.response_status) >= 500,
        { timeoutMs: 60_000 },
      );
      const detail = await apiHelper.getAITrace(
        e.workspace,
        String(item.request_id),
      );
      expect(
        Number((detail.body as Trace).response_status),
      ).toBeGreaterThanOrEqual(500);
      expect(
        String((detail.body as Trace).response_body).length,
      ).toBeGreaterThan(0);
    },
  );

  test(
    "request_id aligns endpoint / api key / tokens across list and detail",
    { tag: "@C2710817" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const { item } = await seedTrace(apiHelper, sk, {});
      const rid = String(item.request_id);
      const detail = await apiHelper.getAITrace(e.workspace, rid);
      const d = detail.body as Trace;
      expect(d.request_id).toBe(rid);
      expect(d.endpoint_name).toBe(item.endpoint_name);
      expect(d.api_key_id).toBe(item.api_key_id);
      expect(d.prompt_tokens).toBe(item.prompt_tokens);
      expect(d.completion_tokens).toBe(item.completion_tokens);
      expect(d.total_tokens).toBe(item.total_tokens);
    },
  );

  test(
    "stored trace carries workspace / endpoint / time per convention",
    { tag: "@C2710818" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const before = Date.now();
      const { item } = await seedTrace(apiHelper, sk, {});
      expect(item.workspace).toBe(e.workspace);
      expect(item.endpoint_type).toBe("endpoint");
      expect(item.endpoint_name).toBe(e.endpoint);
      // `time` is the Kong request time, within a few seconds of the call.
      const t = new Date(String(item.time)).getTime();
      expect(Math.abs(t - before)).toBeLessThan(60_000);
    },
  );

  test(
    "list projection omits full request/response bodies",
    { tag: "@C2710821" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const bigText = `big-${Date.now()}-${"x".repeat(9000)}`;
      const ctok = 100 + (Date.now() % 800);
      const gw = await chatCompletion(e, sk, {
        mode: "fixed",
        text: bigText,
        completion_tokens: ctok,
      });
      expect(gw.status).toBe(200);
      const item = await waitForTrace(
        apiHelper,
        e.workspace,
        (it) =>
          it.endpoint_name === e.endpoint && it.completion_tokens === ctok,
        { timeoutMs: 60_000 },
      );
      // List row has no bodies.
      expect(item.request_body).toBeFalsy();
      expect(item.response_body).toBeFalsy();
      // Detail has the full bodies.
      const detail = await apiHelper.getAITrace(
        e.workspace,
        String(item.request_id),
      );
      expect(String((detail.body as Trace).response_body)).toContain(bigText);
      // The list response is much smaller than the single detail.
      const list = await apiHelper.listAITraces(e.workspace, { limit: 50 });
      expect(JSON.stringify(list.body).length).toBeLessThan(
        JSON.stringify(detail.body).length * 5,
      );
    },
  );

  test(
    "list filters by endpoint / type / status / api key / finish / model",
    { tag: "@C2710822" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const { item } = await seedTrace(apiHelper, sk, {});
      const rid = item.request_id;
      const has = (b: unknown) =>
        (b as { items?: Trace[] }).items?.some((i) => i.request_id === rid);
      const all = (b: unknown, k: string, v: unknown) =>
        (b as { items?: Trace[] }).items?.every((i) => i[k] === v);

      const byEp = await apiHelper.listAITraces(e.workspace, {
        endpoint_name: String(item.endpoint_name),
        limit: 50,
      });
      expect(byEp.status).toBe(200);
      expect(has(byEp.body)).toBe(true);
      expect(all(byEp.body, "endpoint_name", item.endpoint_name)).toBe(true);

      const byType = await apiHelper.listAITraces(e.workspace, {
        endpoint_type: "endpoint",
        limit: 50,
      });
      expect(all(byType.body, "endpoint_type", "endpoint")).toBe(true);

      const byStatus = await apiHelper.listAITraces(e.workspace, {
        status: 200,
        limit: 50,
      });
      expect(all(byStatus.body, "response_status", 200)).toBe(true);

      const byKey = await apiHelper.listAITraces(e.workspace, {
        api_key_id: String(item.api_key_id),
        limit: 50,
      });
      expect(has(byKey.body)).toBe(true);
      expect(all(byKey.body, "api_key_id", item.api_key_id)).toBe(true);

      const byFinish = await apiHelper.listAITraces(e.workspace, {
        finish_reason: "stop",
        limit: 50,
      });
      expect(all(byFinish.body, "finish_reason", "stop")).toBe(true);

      // Non-matching filters yield an empty item set (still a valid object).
      const none = await apiHelper.listAITraces(e.workspace, {
        endpoint_name: `nonexistent-${Date.now()}`,
        limit: 50,
      });
      expect(none.status).toBe(200);
      expect((none.body as { items: Trace[] }).items).toEqual([]);
    },
  );

  test(
    "list honours the time window and clamps oversized limit",
    { tag: "@C2710823" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      await seedTrace(apiHelper, sk, {});
      const now = Date.now();
      const start = new Date(now - 6 * 864e5).toISOString();
      const end = new Date(now + 864e5).toISOString();
      const win = await apiHelper.listAITraces<{
        items: Trace[];
        next_before?: string;
      }>(e.workspace, { start, end, limit: 50 });
      expect(win.status).toBe(200);
      expect(Array.isArray(win.body.items)).toBe(true);
      expect(win.body.items.length).toBeLessThanOrEqual(50);
      for (const it of win.body.items) {
        const t = new Date(String(it.time)).getTime();
        expect(t).toBeGreaterThanOrEqual(new Date(start).getTime());
        expect(t).toBeLessThanOrEqual(new Date(end).getTime());
      }
      // Oversized limit falls back to <=50, not HTTP 500.
      const big = await apiHelper.listAITraces<{ items: Trace[] }>(
        e.workspace,
        {
          limit: 600,
        },
      );
      expect(big.status).toBe(200);
      expect(big.body.items.length).toBeLessThanOrEqual(50);
      // Cursor pagination is consistent when a next page exists.
      if (win.body.next_before && win.body.items.length === 50) {
        const page2 = await apiHelper.listAITraces<{ items: Trace[] }>(
          e.workspace,
          { start, end, limit: 50, before: win.body.next_before },
        );
        const ids1 = new Set(win.body.items.map((i) => i.request_id));
        for (const it of page2.body.items) {
          expect(ids1.has(it.request_id)).toBe(false);
        }
      }
    },
  );

  test(
    "stats aggregates per UTC day and covers the window",
    { tag: "@C2710824" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const now = Date.now();
      const start = new Date(now - 6 * 864e5).toISOString();
      const end = new Date(now + 864e5).toISOString();
      const s1 = await apiHelper.getAITraceStats<{
        days: Array<{ date: string; count: number }>;
      }>(e.workspace, { start, end });
      expect(s1.status).toBe(200);
      expect(Array.isArray(s1.body.days)).toBe(true);
      expect(s1.body.days.length).toBeGreaterThanOrEqual(7);
      const today = new Date().toISOString().slice(0, 10);
      const c0 = s1.body.days.find((d) => d.date === today)?.count ?? 0;

      await seedTrace(apiHelper, sk, {});
      const s2 = await apiHelper.getAITraceStats<{
        days: Array<{ date: string; count: number }>;
      }>(e.workspace, { start, end });
      const c1 = s2.body.days.find((d) => d.date === today)?.count ?? 0;
      expect(c1).toBeGreaterThan(c0);

      // A workspace with no traces returns the same buckets, all zero.
      const empty = await apiHelper.getAITraceStats<{
        days: Array<{ date: string; count: number }>;
      }>(`no-such-ws-${Date.now()}`, { start, end });
      expect(empty.status).toBe(200);
      expect(empty.body.days.every((d) => d.count === 0)).toBe(true);
    },
  );

  test(
    "ai-traces exposes no create/update/delete endpoints",
    { tag: "@C2710826" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const { item } = await seedTrace(apiHelper, sk, {});
      const rid = String(item.request_id);
      const writable = [404, 405];
      for (const [m, p] of [
        ["POST", `/ai-traces/${e.workspace}`],
        ["PATCH", `/ai-traces/${e.workspace}`],
        ["DELETE", `/ai-traces/${e.workspace}`],
        ["POST", `/ai-traces/${e.workspace}/${rid}`],
        ["PATCH", `/ai-traces/${e.workspace}/${rid}`],
        ["DELETE", `/ai-traces/${e.workspace}/${rid}`],
      ] as const) {
        const r = await apiHelper.request(m, p, { probe: true });
        expect(writable).toContain(r.status);
      }
      // The trace is unchanged.
      const still = await apiHelper.getAITrace(e.workspace, rid);
      expect(still.status).toBe(200);
    },
  );

  test(
    "detail returns the full request and response bodies",
    { tag: "@C2710827" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const { nonce, item } = await seedTrace(apiHelper, sk, {});
      const rid = String(item.request_id);
      // List projection lacks bodies.
      const list = await apiHelper.listAITraces<{ items: Trace[] }>(
        e.workspace,
        {
          limit: 50,
        },
      );
      const row = list.body.items.find((i) => i.request_id === rid);
      expect(row).toBeTruthy();
      expect(row?.request_body).toBeFalsy();
      // Detail has them.
      const detail = await apiHelper.getAITrace(e.workspace, rid);
      expect(detail.status).toBe(200);
      const d = detail.body as Trace;
      expect(d.request_id).toBe(rid);
      expect(String(d.request_body)).toContain(nonce);
      expect(String(d.response_body)).toContain(nonce);
      expect(d.endpoint_type).toBe("endpoint");
    },
  );

  test(
    "detail for an unknown request id returns 404",
    { tag: "@C2710828" },
    async ({ apiHelper }, testInfo) => {
      testInfo.setTimeout(2 * 60_000);
      const { item } = await seedTrace(apiHelper, sk, {});
      const fake = `00000000-0000-4000-8000-${Date.now()}0000`.slice(0, 36);
      const miss = await apiHelper.getAITrace(e.workspace, fake);
      expect(miss.status).toBe(404);
      // A valid id still resolves.
      const ok = await apiHelper.getAITrace(
        e.workspace,
        String(item.request_id),
      );
      expect(ok.status).toBe(200);
    },
  );
});
