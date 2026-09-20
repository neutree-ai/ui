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
      `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&model=${encodeURIComponent(model)}`,
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
    await expect(
      frame.getByText("完成请求 / Completed", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await page
      .frameLocator('iframe[title="Grafana Dashboard neutree-model-routing"]')
      .getByRole("heading", { name: "完成请求 / Completed", exact: true })
      .hover();
    await page.mouse.wheel(0, 650);
    await frame.getByRole("table").first().hover();
    await page.mouse.wheel(0, 450);
    const table = frame
      .getByRole("region", {
        name: "各目标实际分流 / Selected targets",
        exact: true,
      })
      .getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(
      table.getByRole("columnheader", { name: "P99 总耗时", exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "平均总耗时", exact: true }),
    ).toBeVisible();
    await expect(table.getByRole("row").nth(1).getByRole("cell")).toHaveCount(
      8,
    );
    await expect(
      table.getByRole("row").nth(1).getByRole("cell").nth(5),
    ).not.toContainText("—");
    await expect(
      table.getByRole("row").nth(1).getByRole("cell").nth(6),
    ).not.toContainText("—");
    await table.hover();
    await page.mouse.wheel(0, 900);
    await frame
      .getByRole("button", { name: "Expand row", exact: true })
      .click();
    const capacity = frame.getByRole("table").nth(2);
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
    await expect(
      frame.getByText("完成请求 / Completed", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
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
      `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor`,
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
    await page
      .frameLocator('iframe[title="Grafana Dashboard neutree-model-routing"]')
      .getByRole("heading", { name: "完成请求 / Completed", exact: true })
      .hover();
    await page.mouse.wheel(0, 650);
    const frame = page.frameLocator(
      'iframe[title="Grafana Dashboard neutree-model-routing"]',
    );
    const models = frame.getByRole("region", {
      name: "按模型请求与错误 / Requests and errors by model",
      exact: true,
    });
    const unknown = models
      .getByRole("row")
      .filter({ hasText: "未识别或缺失 / Unknown" });
    await expect(unknown).toBeVisible({ timeout: 30000 });
    // Run scripts/monitoring/e2e.py with REAL_ENDPOINT_SCOPE first to seed an
    // unknown-model failure. This asserts real stored traffic, not only a filter URL.
    await expect
      .poll(
        async () => Number(await unknown.getByRole("cell").last().innerText()),
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
      `/#/${workspace}/external-endpoints/show/${endpoint}?tab=monitor&model=${encodeURIComponent(model)}`,
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
    await expect(
      frame.getByRole("heading", {
        name: "P99 总耗时 / Duration",
        exact: true,
      }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      frame.getByRole("heading", {
        name: "平均总耗时 / Mean duration",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .frameLocator('iframe[title="Grafana Dashboard neutree-model-routing"]')
      .getByRole("heading", { name: "完成请求 / Completed", exact: true })
      .hover();
    await page.mouse.wheel(0, 850);
    const summary = frame.getByRole("region", {
      name: "按模型请求与错误 / Requests and errors by model",
      exact: true,
    });
    await expect(summary.getByRole("row")).toHaveCount(3, { timeout: 30000 });
    await expect(
      summary.getByRole("cell", { name: model, exact: true }),
    ).toBeVisible();
    await expect(
      summary.getByRole("cell", { name: "test-model-weighted", exact: true }),
    ).toBeVisible();
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
