import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/base";

const user = {
  id: "00000000-0000-4000-8000-000000000848",
  email: "layout-test@example.invalid",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { username: "layout-test" },
};

const endpoint = {
  id: 848,
  api_version: "v1",
  kind: "Endpoint",
  metadata: {
    name: "layout-endpoint",
    workspace: "default",
    creation_timestamp: "2026-10-19T00:00:00Z",
    update_timestamp: "2026-10-19T00:00:00Z",
    deletion_timestamp: null,
    labels: {},
    annotations: {},
  },
  spec: {
    cluster: "layout-cluster",
    engine: { engine: "vllm", version: "layout-test" },
    model: { name: "layout-model", task: "text-generation" },
    replicas: { num: 1 },
    resources: null,
    deployment_options: null,
    variables: null,
    env: null,
  },
  status: { phase: "Running", service_url: null },
};

const responses: Record<string, unknown> = {
  "auth/user": user,
  endpoints: [endpoint],
  engines: [
    {
      metadata: { name: "vllm" },
      spec: { versions: [{ version: "layout-test" }] },
    },
  ],
  clusters: [
    {
      metadata: { name: "layout-cluster", workspace: "default" },
      spec: { type: "kubernetes" },
    },
  ],
  workspaces: [{ metadata: { name: "default" } }],
  oem_configs: [],
  "system/info": { version: "layout-test" },
  license: { status: { usage: { Workspace: { limit: 1 } } } },
  "serve-proxy/default/layout-endpoint/v1/models": {
    object: "list",
    data: [{ id: "layout-model" }],
  },
};

function completionStream(content: string) {
  const chunks = [
    { delta: { role: "assistant", content }, finish_reason: null },
    { delta: {}, finish_reason: "stop" },
  ];
  return `${chunks
    .map(
      (choice) =>
        `data: ${JSON.stringify({
          id: "layout-response",
          object: "chat.completion.chunk",
          created: 0,
          model: "layout-model",
          choices: [{ index: 0, ...choice }],
        })}\n\n`,
    )
    .join("")}data: [DONE]\n\n`;
}

async function mockPlayground(page: Page, content: string) {
  await page.addInitScript((identity) => {
    localStorage.setItem("i18nextLng", "en-US");
    localStorage.setItem(
      "supabase.auth.token",
      JSON.stringify({
        access_token: "mock-layout-access-token",
        refresh_token: "mock-layout-refresh-token",
        token_type: "bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: identity,
      }),
    );
  }, user);

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1/", "");
    if (path === "serve-proxy/default/layout-endpoint/v1/chat/completions") {
      expect(request.method()).toBe("POST");
      const answer =
        request.postDataJSON().messages.length === 1
          ? content
          : "Follow-up received.";
      await route.fulfill({
        contentType: "text/event-stream",
        body: completionStream(answer),
      });
      return;
    }

    expect(request.method(), `Unexpected API write: ${path}`).toBe("GET");
    expect(responses, `Unmocked API request: ${path}`).toHaveProperty(path);
    await route.fulfill({ json: responses[path] });
  });
}

async function expectViewportLayout(page: Page, playground: Locator) {
  await expect(
    playground.getByRole("button", { name: "Send", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    playground.getByPlaceholder("Chat with your AI model...", { exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      page
        .getByRole("main")
        .evaluate((main) =>
          Math.max(
            main.scrollWidth - main.clientWidth,
            document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
            document.body.scrollWidth - document.body.clientWidth,
          ),
        ),
    )
    .toBeLessThanOrEqual(1);
}

const longText = "0123456789abcdef".repeat(256);

test.describe("chat playground layout (NEU-848)", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });

  for (const scenario of [
    { name: "long unbroken text", markdown: longText, preformatted: false },
    {
      name: "long inline code",
      markdown: `\`${longText}\``,
      preformatted: false,
    },
    {
      name: "long preformatted code",
      markdown: `\`\`\`text\n${longText}\n\`\`\``,
      preformatted: true,
    },
  ]) {
    test(`${scenario.name} keeps Send onscreen and permits another message`, async ({
      page,
      endpoints,
    }) => {
      await mockPlayground(page, scenario.markdown);
      await endpoints.goToShow(endpoint.metadata.name);
      await page.getByRole("tab", { name: "Playground", exact: true }).click();
      const playground = page.getByRole("tabpanel", { name: "Playground" });
      const input = playground.getByPlaceholder("Chat with your AI model...", {
        exact: true,
      });
      const send = playground.getByRole("button", {
        name: "Send",
        exact: true,
      });
      await expect(input).toBeEnabled();
      await expectViewportLayout(page, playground);

      await input.fill("First question");
      await send.click();
      await expect(playground.getByText(longText)).toBeVisible();
      await expect(input).toBeEnabled();
      await expectViewportLayout(page, playground);

      if (scenario.preformatted) {
        const code = playground.locator("pre").filter({ hasText: longText });
        await expect(code).toContainText(longText);
        await expect(code).toHaveCSS("overflow-x", /auto|scroll/);
        expect(
          await code.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
        ).toBeGreaterThan(0);
        await code.evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
        });
        await expect
          .poll(() => code.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
        await expect
          .poll(() =>
            code.evaluate(
              (element) =>
                element.scrollWidth - element.clientWidth - element.scrollLeft,
            ),
          )
          .toBeLessThanOrEqual(1);
        await expectViewportLayout(page, playground);
      } else {
        const paragraph = playground.locator("p").filter({ hasText: longText });
        const layout = await paragraph.evaluate((element) => ({
          overflow: element.scrollWidth - element.clientWidth,
          height: element.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
        }));
        expect(layout.overflow).toBeLessThanOrEqual(1);
        expect(layout.height).toBeGreaterThan(layout.lineHeight + 1);
      }

      const nextRequest = page.waitForRequest("**/v1/chat/completions");
      await input.fill("Continue");
      await expect(send).toBeEnabled();
      await send.click();
      expect((await nextRequest).postDataJSON().messages).toEqual([
        { role: "user", content: "First question" },
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining(longText),
        }),
        { role: "user", content: "Continue" },
      ]);
      await expect(playground.getByText("Follow-up received.")).toBeVisible();
      await expect(input).toBeEnabled();
      await expectViewportLayout(page, playground);
    });
  }
});
