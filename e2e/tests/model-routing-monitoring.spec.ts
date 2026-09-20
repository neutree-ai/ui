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
    await expect(page.locator("#monitor-model")).toContainText(model);
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
    await iframe.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 650);
    const table = frame.getByRole("table").first();
    await expect(table.getByRole("row")).toHaveCount(2);
    await page.locator("#monitor-mode").click();
    await page.getByRole("option", { name: /^(Streaming|流式)$/ }).click();
    await expect(iframe).toHaveAttribute("src", /var-mode=stream/);
    await page.locator("#monitor-time").click();
    await page
      .getByRole("option", { name: /Last 6 hours|最近 6 小时/ })
      .click();
    await expect(iframe).toHaveAttribute("src", /from=now-6h/);
    await page.getByRole("button", { name: /Pause|暂停/ }).click();
    await expect(iframe).not.toHaveAttribute("src", /[?&]refresh=/);
    await page.reload();
    await expect(page.locator("#monitor-model")).toContainText(model);
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
    expect(new URL(src!).searchParams.getAll("var-model_literal")).toEqual([
      JSON.stringify(historical),
    ]);
    await expect
      .poll(() => queries.length, { timeout: 30000 })
      .toBeGreaterThan(0);
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
});
