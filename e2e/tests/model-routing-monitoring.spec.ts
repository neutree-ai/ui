import { expect, test } from "@playwright/test";

const endpoint = process.env.E2E_MONITORING_ENDPOINT;
const model = process.env.E2E_MONITORING_MODEL ?? "test-qwen";
const workspace = process.env.E2E_MONITORING_WORKSPACE ?? "default";

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

test("only the three main rows collapse all of their metrics together", async ({
  page,
}) => {
  test.skip(!endpoint, "Requires the deployed monitoring dashboard");
  await page.goto(
    `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&from=now-24h&refresh=off`,
  );
  const frame = page.frameLocator(
    'iframe[title="Grafana Dashboard neutree-model-routing"]',
  );
  await expect(frame.locator('[data-griditem-key^="panel-"]')).toHaveCount(3, {
    timeout: 30000,
  });
  for (const [rowId, panelIds] of [
    [101, [13, 30, 3, 31, 14, 15, 6]],
    [103, [8, 32, 33, 20, 4, 21, 22, 34, 12, 35]],
  ] as const) {
    const row = frame.locator(`[data-griditem-key="panel-${rowId}"]`);
    await row.scrollIntoViewIfNeeded();
    await row
      .getByRole("button", { name: "Collapse row", exact: true })
      .click();
    for (const id of panelIds)
      await expect(
        frame.locator(`[data-griditem-key="grid-item-${id}"]`),
      ).toHaveCount(0);
    await row.getByRole("button", { name: "Expand row", exact: true }).click();
    for (const id of panelIds)
      await expect(
        frame.locator(`[data-griditem-key="grid-item-${id}"]`),
      ).toHaveCount(1);
  }
});

test("Grafana owns model mode time zoom and refresh without stale outer controls", async ({
  page,
}) => {
  test.skip(!endpoint, "Requires deployed monitoring");
  test.setTimeout(60000);
  const queryChecks: Promise<void>[] = [];
  page.on("response", (response) => {
    if (
      response.url().includes("/api/ds/query") &&
      response.request().method() === "POST"
    ) {
      queryChecks.push(
        (async () => {
          expect(response.status()).toBe(200);
          const result = await response.json();
          for (const value of Object.values(result.results ?? {}) as {
            error?: string;
          }[])
            expect(value.error).toBeFalsy();
        })(),
      );
    }
  });
  await page.goto(
    `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&from=now-24h&model=${encodeURIComponent(model)}&refresh=off`,
  );
  const frame = page.frameLocator(
    'iframe[title="Grafana Dashboard neutree-model-routing"]',
  );
  const time = frame.getByRole("button", { name: /^Time range selected:/ });
  await expect(time).toContainText("Last 24 hours", { timeout: 30000 });
  await expect(
    page.locator("#monitor-model, #monitor-mode, #monitor-time"),
  ).toHaveCount(0);
  const state = async () =>
    new URL(await frame.locator("body").evaluate(() => window.location.href));
  await frame.getByRole("combobox").nth(0).click();
  await frame
    .locator('[id^="react-select-"][id*="-option-"]')
    .filter({ hasText: /^test-model-weighted$/ })
    .click();
  await frame.getByRole("combobox").nth(0).press("Escape");
  await expect
    .poll(async () => (await state()).searchParams.getAll("var-model"))
    .toEqual([model, "test-model-weighted"]);
  await frame.getByRole("combobox").nth(1).click();
  await frame.getByText("流式", { exact: true }).click();
  await expect
    .poll(async () => (await state()).searchParams.get("var-mode"))
    .toBe("stream");
  await frame
    .getByRole("button", { name: /Choose refresh time interval/ })
    .click();
  await frame
    .getByRole("menuitemradio", { name: "30 seconds", exact: true })
    .click();
  await expect
    .poll(async () => (await state()).searchParams.get("refresh"))
    .toBe("30s");
  await frame
    .getByRole("button", { name: /Choose refresh time interval/ })
    .click();
  await frame
    .getByRole("menuitemradio", { name: "Turn off auto refresh", exact: true })
    .click();
  await expect
    .poll(async () => (await state()).searchParams.get("refresh") || "")
    .toBe("");
  const chart = frame.locator('[data-griditem-key="grid-item-30"]');
  await chart.scrollIntoViewIfNeeded();
  const plot = chart.locator(".u-over");
  await expect(plot).toBeVisible();
  const box = (await plot.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45, {
    steps: 12,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await state()).searchParams.get("from"))
    .toMatch(/^\d{4}-\d{2}-\d{2}T/);
  const zoomed = await state();
  const before = [
    zoomed.searchParams.get("from"),
    zoomed.searchParams.get("to"),
  ];
  await time.scrollIntoViewIfNeeded();
  await expect(time).not.toContainText("Last 24 hours");
  await frame.getByRole("combobox").nth(0).click();
  await frame
    .locator('[id^="react-select-"][id*="-option-"]')
    .filter({ hasText: /^test-model-weighted$/ })
    .click();
  await frame.getByRole("combobox").nth(0).press("Escape");
  await expect
    .poll(async () => (await state()).searchParams.getAll("var-model"))
    .toEqual([model]);
  const after = await state();
  expect([
    after.searchParams.get("from"),
    after.searchParams.get("to"),
  ]).toEqual(before);
  // A native time selection can reset the zoom; its label and URL update together.
  await time.click();
  await frame.getByText("Last 24 hours", { exact: true }).click();
  await expect(time).toContainText("Last 24 hours");
  await expect
    .poll(async () => (await state()).searchParams.get("from"))
    .toBe("now-24h");
  await expect.poll(() => queryChecks.length).toBeGreaterThan(0);
  await Promise.all(queryChecks);
});

test("native All includes unknown model failures and allows model selection", async ({
  page,
}) => {
  test.skip(!endpoint, "Requires deployed monitoring");
  await page.goto(
    `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&from=now-24h&refresh=off`,
  );
  const frame = page.frameLocator(
    'iframe[title="Grafana Dashboard neutree-model-routing"]',
  );
  await expect(frame.getByRole("combobox").nth(0)).toBeVisible({
    timeout: 30000,
  });
  await frame
    .locator('[data-griditem-key="grid-item-13"]')
    .scrollIntoViewIfNeeded();
  const unknown = frame
    .getByRole("region", { name: "对外模型对比", exact: true })
    .getByRole("row")
    .filter({ hasText: "未识别或缺失" });
  await expect
    .poll(async () =>
      Number(await unknown.getByRole("cell").nth(4).innerText()),
    )
    .toBeGreaterThan(0);
});

test("native Prometheus variables safely preserve historical names with special characters", async ({
  page,
}) => {
  test.skip(!endpoint, "Requires deployed monitoring");
  const historical = '历史"\\.+&model=other';
  const checks: Promise<void>[] = [];
  page.on("response", (response) => {
    if (
      response.url().includes("/api/ds/query") &&
      response.request().method() === "POST"
    ) {
      checks.push(
        (async () => {
          expect(response.status()).toBe(200);
          const result = await response.json();
          for (const value of Object.values(result.results ?? {}) as {
            error?: string;
          }[])
            expect(value.error).toBeFalsy();
          for (const query of response.request().postDataJSON().queries) {
            const matcher = query.expr?.match(
              /virtual_model=~("(?:\\.|[^"\\])*")/,
            );
            if (!matcher) continue;
            const regex = new RegExp(`^(?:${JSON.parse(matcher[1])})$`);
            expect(regex.test(historical)).toBe(true);
            expect(regex.test("other")).toBe(false);
          }
        })(),
      );
    }
  });
  await page.goto(
    `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&model=${encodeURIComponent(historical)}&refresh=off`,
  );
  const frame = page.frameLocator(
    'iframe[title="Grafana Dashboard neutree-model-routing"]',
  );
  await expect(frame.getByText(historical, { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect.poll(() => checks.length).toBeGreaterThan(0);
  await page.waitForLoadState("networkidle");
  await Promise.all(checks);
});
