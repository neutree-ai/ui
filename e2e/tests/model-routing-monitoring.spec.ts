import { expect, test } from "@playwright/test";

const endpoint = process.env.E2E_MONITORING_ENDPOINT;
const model = process.env.E2E_MONITORING_MODEL ?? "test-qwen";
const workspace = process.env.E2E_MONITORING_WORKSPACE ?? "default";

test.describe("external endpoint monitoring", () => {
  test.skip(
    !endpoint,
    "Set E2E_MONITORING_ENDPOINT to an existing model-routes endpoint",
  );

  test("keeps model, mode, time and pause state through reload, with valid Grafana queries", async ({
    page,
  }) => {
    test.setTimeout(60000); // Multiple real Grafana reloads and query batches.
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      // Grafana 11.5 unconditionally calls window.caches.keys() in its root
      // component. CacheStorage is absent on an HTTP LAN origin. Keep this
      // separately reported; it is unrelated to panel rendering/query errors.
      if (
        error.message ===
          "Cannot read properties of undefined (reading 'keys')" &&
        error.stack?.includes("mf.componentDidMount") &&
        error.stack.includes(":3030/public/build/")
      ) {
        test.info().annotations.push({
          type: "environment",
          description:
            "Grafana 11.5 icon-cache cleanup requires a secure origin; dev Grafana uses HTTP.",
        });
      } else {
        errors.push(error.message);
      }
    });
    const queries: Promise<void>[] = [];
    page.on("response", (response) => {
      if (
        response.url().includes("/api/ds/query") &&
        response.request().method() === "POST"
      ) {
        queries.push(
          (async () => {
            expect(response.status()).toBe(200);
            const result = await response.json();
            for (const frame of Object.values(result.results ?? {}) as {
              error?: string;
            }[])
              expect(frame.error).toBeFalsy();
          })(),
        );
      }
    });
    await page.goto(
      `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&from=now-24h&model=${encodeURIComponent(model)}`,
    );
    await expect(page.locator("#monitor-model")).toContainText(model, {
      timeout: 30000,
    });
    const iframe = page.locator(
      'iframe[title="Grafana Dashboard neutree-model-routing"]',
    );
    await expect(iframe).toBeVisible();
    const frame = page.frameLocator(
      'iframe[title="Grafana Dashboard neutree-model-routing"]',
    );
    await expect(frame.getByText("完成请求", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await frame
      .locator('[data-griditem-key="grid-item-8"]')
      .scrollIntoViewIfNeeded();
    const table = frame
      .getByRole("region", {
        name: "上游模型对比",
        exact: true,
      })
      .getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(
      table.getByRole("columnheader", { name: "P99 完整耗时", exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "平均完整耗时", exact: true }),
    ).toBeVisible();
    await expect(table.getByRole("row").nth(1).getByRole("cell")).toHaveCount(
      12,
    );
    await expect(
      table.getByRole("row").nth(1).getByRole("cell").nth(9),
    ).not.toContainText("—");
    await expect(
      table.getByRole("row").nth(1).getByRole("cell").nth(10),
    ).not.toContainText("—");
    await frame
      .locator('[data-griditem-key="panel-50"]')
      .scrollIntoViewIfNeeded();
    await frame
      .getByRole("heading", {
        name: "实例容量详情（全部调用类型）",
        exact: true,
      })
      .click();
    await frame
      .locator('[data-griditem-key="grid-item-12"]')
      .scrollIntoViewIfNeeded();
    const capacity = frame
      .getByRole("region", {
        name: "实例容量详情",
        exact: true,
      })
      .getByRole("table");
    await expect(capacity.getByRole("row")).toHaveCount(2);
    await expect(capacity).toContainText(/无限制|Unlimited/);
    await page.waitForLoadState("networkidle");
    await Promise.all(queries);
    await page.locator("#monitor-mode").click();
    await page.getByRole("option", { name: /^(Streaming|流式)$/ }).click();
    await expect(iframe).toHaveAttribute("src", /var-mode=stream/);
    await page.waitForLoadState("networkidle");
    await Promise.all(queries);
    await page.locator("#monitor-time").click();
    await page
      .getByRole("option", { name: /Last 6 hours|最近 6 小时/ })
      .click();
    await expect(iframe).toHaveAttribute("src", /from=now-6h/);
    await page.waitForLoadState("networkidle");
    await Promise.all(queries);
    await page.getByRole("button", { name: /Pause|暂停/ }).click();
    await expect(iframe).not.toHaveAttribute("src", /[?&]refresh=/);
    await page.waitForLoadState("networkidle");
    await Promise.all(queries);
    await page.reload();
    await expect(page.locator("#monitor-model")).toContainText(model, {
      timeout: 30000,
    });
    await expect(iframe).toHaveAttribute("src", /var-mode=stream/);
    await expect(iframe).not.toHaveAttribute("src", /[?&]refresh=/);
    await expect(frame.getByText("完成请求", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect
      .poll(async () => {
        const url = await frame
          .locator("body")
          .evaluate(() => window.location.href);
        return new URL(url).searchParams.get("refresh") || "";
      })
      .toBe("");
    await expect
      .poll(() => queries.length, { timeout: 30000 })
      .toBeGreaterThan(0);
    await Promise.all(queries);
    expect(errors).toEqual([]);
  });

  test("preserves a historical model and rejects an invalid absolute time range", async ({
    page,
  }) => {
    const queries: Promise<void>[] = [];
    page.on("response", (response) => {
      if (
        response.url().includes("/api/ds/query") &&
        response.request().method() === "POST"
      ) {
        queries.push(
          (async () => {
            expect(response.status()).toBe(200);
            const result = await response.json();
            for (const frame of Object.values(result.results ?? {}) as {
              error?: string;
            }[])
              expect(frame.error).toBeFalsy();
          })(),
        );
      }
    });
    const historical = '历史"\\.+&model=other';
    await page.goto(
      `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&model=${encodeURIComponent(historical)}`,
    );
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /historical metrics|历史指标/ }),
    ).toBeVisible();
    await expect(page.locator("#monitor-model")).toContainText(historical);
    const src = await page
      .locator('iframe[title="Grafana Dashboard neutree-model-routing"]')
      .getAttribute("src");
    expect(new URL(src!).searchParams.getAll("var-model_regex")).toEqual([
      JSON.stringify(historical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    ]);
    await expect
      .poll(() => queries.length, { timeout: 30000 })
      .toBeGreaterThan(0);
    await Promise.all(queries);
    await page.waitForLoadState("networkidle");
    await Promise.all(queries);
    await page.locator("#monitor-time").click();
    await page.getByRole("option", { name: /Custom range|自定义时间/ }).click();
    await page.locator("#monitor-from").fill("2026-09-20T12:00");
    await page.locator("#monitor-to").fill("2026-09-20T11:00");
    await page.getByRole("button", { name: /^(Apply|应用)$/ }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /after start|晚于/ }),
    ).toBeVisible();
    await page.locator("#monitor-to").fill("2026-09-20T13:00");
    await page.getByRole("button", { name: /^(Apply|应用)$/ }).click();
    await expect(
      page.getByRole("button", { name: /Resume|恢复/ }),
    ).toBeDisabled();
  });
  test("defaults to all models and includes unknown-model failures", async ({
    page,
  }) => {
    await page.goto(
      `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&from=now-24h`,
    );
    await expect(page.locator("#monitor-model")).toContainText(
      /All models|全部模型/,
    );
    const iframe = page.locator(
      'iframe[title="Grafana Dashboard neutree-model-routing"]',
    );
    const src = await iframe.getAttribute("src");
    expect(new URL(src!).searchParams.get("var-model_regex")).toBe(
      JSON.stringify(".*"),
    );
    const frame = page.frameLocator(
      'iframe[title="Grafana Dashboard neutree-model-routing"]',
    );
    await frame
      .locator('[data-griditem-key="grid-item-13"]')
      .scrollIntoViewIfNeeded();
    const models = frame.getByRole("region", {
      name: "对外模型对比",
      exact: true,
    });
    const unknown = models.getByRole("row").filter({ hasText: "未识别或缺失" });
    await expect(unknown).toBeVisible({ timeout: 30000 });
    // Run scripts/monitoring/e2e.py with REAL_ENDPOINT_SCOPE first to seed an
    // unknown-model failure. This asserts real stored traffic, not only a filter URL.
    await expect
      .poll(
        async () => Number(await unknown.getByRole("cell").nth(4).innerText()),
        { timeout: 30000 },
      )
      .toBeGreaterThan(0);
    await expect(
      models.getByRole("cell", { name: model, exact: true }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.locator("#monitor-model").click();
    await page.getByRole("checkbox", { name: model, exact: true }).check();
    await page.getByRole("button", { name: /^(Apply|应用)$/ }).click();
    await expect(page.locator("#monitor-model")).toContainText(model);
    await page.waitForLoadState("networkidle");
    await page.locator("#monitor-model").click();
    await page.getByRole("checkbox", { name: /All models|全部模型/ }).check();
    await page.getByRole("button", { name: /^(Apply|应用)$/ }).click();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.locator("#monitor-model")).toContainText(
      /All models|全部模型/,
    );
    expect(new URLSearchParams(page.url().split("?")[1]).has("model")).toBe(
      false,
    );
  });
  test("applies multiple models together and shows all latency statistics", async ({
    page,
  }) => {
    await page.goto(
      `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&from=now-24h&model=${encodeURIComponent(model)}`,
    );
    await page.waitForLoadState("networkidle");
    await page.locator("#monitor-model").click();
    await page
      .getByRole("checkbox", { name: "test-model-weighted", exact: true })
      .check();
    expect(
      new URLSearchParams(page.url().split("?")[1]).getAll("model"),
    ).toEqual([model]);
    await page.getByRole("button", { name: /^(Apply|应用)$/ }).click();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.locator("#monitor-model")).toContainText(
      "test-model-weighted",
    );
    expect(
      new URLSearchParams(page.url().split("?")[1]).getAll("model"),
    ).toEqual([model, "test-model-weighted"]);
    const frame = page.frameLocator(
      'iframe[title="Grafana Dashboard neutree-model-routing"]',
    );
    await frame
      .locator('[data-griditem-key="grid-item-13"]')
      .scrollIntoViewIfNeeded();
    const summary = frame.getByRole("region", {
      name: "对外模型对比",
      exact: true,
    });
    await expect(summary.getByRole("row")).toHaveCount(3, { timeout: 30000 });
    await expect(
      summary.getByRole("cell", { name: model, exact: true }),
    ).toBeVisible();
    await expect(
      summary.getByRole("cell", { name: "test-model-weighted", exact: true }),
    ).toBeVisible();
    await frame
      .locator('[data-griditem-key="panel-104"]')
      .scrollIntoViewIfNeeded();
    await frame
      .getByRole("heading", {
        name: "更多上游耗时：P99、平均完整耗时",
        exact: true,
      })
      .click();
    for (const [id, title] of [
      [21, "各上游 P99 完整耗时"],
      [22, "各上游平均完整耗时"],
      [20, "各上游 P95 完整耗时"],
      [32, "各上游完成速率"],
      [33, "各上游 HTTP 非2xx率"],
    ] as const) {
      await frame
        .locator(`[data-griditem-key="grid-item-${id}"]`)
        .scrollIntoViewIfNeeded();
      const chart = frame.getByRole("region", { name: title, exact: true });
      await expect(
        chart.getByRole("button", {
          name: `${model} · qwen-internal · Qwen/Qwen2.5-0.5B-Instruct`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        chart.getByRole("button", {
          name: "test-model-weighted · smartp1 · gpt-6-astra",
          exact: true,
        }),
      ).toBeVisible();
    }
    await page.waitForLoadState("networkidle");
    await page.locator("#monitor-model").click();
    await page
      .getByRole("checkbox", { name: "test-model-weighted", exact: true })
      .uncheck();
    await page.getByRole("button", { name: /^(Apply|应用)$/ }).click();
    await expect(page.locator("#monitor-model")).not.toContainText(
      "test-model-weighted",
    );
  });
});

// Controlled datasource responses exercise the real Grafana table transforms,
// including identities that collide when joined using a display delimiter.
test("target table keeps tuple identities, no-sample states and model-wide shares", async ({
  page,
}) => {
  test.skip(!endpoint, "Requires the deployed monitoring dashboard");
  const rows = [
    {
      virtual_model: "route",
      upstream: "A",
      upstream_model: "shared",
      values: [320, 0.8, 16, 0.95, 2, 3, 2.8, 1, 304],
    },
    {
      virtual_model: "route",
      upstream: "B",
      upstream_model: "shared",
      values: [80, 0.2, 80, 0, -1, 0, -1, -1, 0],
    },
    {
      virtual_model: "a / b",
      upstream: "c",
      upstream_model: 'shared"\\',
      values: [0, -1, 0, -1, -1, 0, -1, -1, 0],
    },
    {
      virtual_model: "a",
      upstream: "b / c",
      upstream_model: 'shared"\\',
      values: [10, 1, 0, 1, 1, 0, 1.5, 0.5, 10],
    },
  ];
  await page.route("**/api/ds/query*", async (route) => {
    const body = route.request().postDataJSON();
    if (
      !body?.queries?.some((q: { expr?: string }) =>
        q.expr?.includes('"metric_column", "模型内分流"'),
      )
    ) {
      await route.continue();
      return;
    }
    const results: Record<string, unknown> = {};
    for (const [index, query] of body.queries.entries()) {
      const column = query.expr.match(/"metric_column", "([^"]+)"/)[1];
      results[query.refId] = {
        status: 200,
        frames: rows.map(({ values, ...identity }) => ({
          schema: {
            refId: query.refId,
            meta: { type: "numeric-multi", custom: { resultType: "vector" } },
            fields: [
              { name: "Time", type: "time" },
              {
                name: "Value",
                type: "number",
                labels: { ...identity, metric_column: column },
              },
            ],
          },
          data: { values: [[1789950000000], [values[index]]] },
        })),
      };
    }
    await route.fulfill({ json: { results } });
  });
  await page.goto(
    `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&from=now-24h&refresh=off`,
  );
  const frame = page.frameLocator(
    'iframe[title="Grafana Dashboard neutree-model-routing"]',
  );
  await frame
    .locator('[data-griditem-key="grid-item-8"]')
    .scrollIntoViewIfNeeded();
  const table = frame
    .getByRole("region", { name: "上游模型对比", exact: true })
    .getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(5);
  const dataRows = table
    .getByRole("row")
    .filter({ has: frame.getByRole("cell") });
  // Sorting by completed count keeps the two ambiguous identities separate.
  const cells = await dataRows.evaluateAll((rs) =>
    rs.map((r) =>
      Array.from(r.querySelectorAll('[role="cell"]')).map((c) => c.textContent),
    ),
  );
  expect(cells.map((r) => r.slice(0, 3))).toEqual([
    ["route", "A", "shared"],
    ["route", "B", "shared"],
    ["a", "b / c", 'shared"\\'],
    ["a / b", "c", 'shared"\\'],
  ]);
  expect(cells[0][6]).toMatch(/95/);
  expect(cells[1][4]).toMatch(/20/);
  expect(cells[1][6]).toMatch(/^0/);
  expect(cells[1][7]).toBe("无成功样本");
  expect(cells[3][6]).toBe("—");
  // Bring the whole embedded viewport into view before opening its popup.
  await page
    .locator('iframe[title="Grafana Dashboard neutree-model-routing"]')
    .scrollIntoViewIfNeeded();
  // Grafana's column filter acts after the query: the remaining B row stays 20%.
  await table
    .getByRole("columnheader", { name: "上游", exact: true })
    .getByRole("button")
    .last()
    .click();
  await frame.getByRole("checkbox", { name: "B", exact: true }).check();
  await frame.getByRole("button", { name: "Ok", exact: true }).click();
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(
    table.getByRole("row").nth(1).getByRole("cell").nth(4),
  ).toHaveText("20.0%");
});
