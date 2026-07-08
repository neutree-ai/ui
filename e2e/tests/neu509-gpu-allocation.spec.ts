import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import type { ApiHelper } from "../helpers/api-helper";
import { ResourcePage } from "../helpers/resource-page";

const WORKSPACE = "default";
const MODEL_REGISTRY = "bentoml";
const MODEL_NAME = "qwen2.5-0.5b-instruct";
const L20_ENDPOINT = "neu509-sglang-l20";
const SSH_ENDPOINT = "vllm-ssh-old-1";
const L20_DEVICE_MEMORY_MIB = 46068;

const managedEndpointNames = [
  L20_ENDPOINT,
  SSH_ENDPOINT,
  "neu509-l20-blocked",
  "neu509-ssh-blocked",
];

type EndpointRecord = {
  metadata?: { name?: string };
  status?: {
    phase?: string;
    resources?: {
      replicas?: Array<{
        devices?: unknown[];
      }>;
    };
  };
};

test.describe("NEU-509 GPU allocation E2E", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new (await import("../helpers/api-helper")).ApiHelper(page);

    await deleteAllEndpoints(api);
    await waitForNoManagedEndpoints(api);
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const api = new (await import("../helpers/api-helper")).ApiHelper(page);

    await deleteAllEndpoints(api);
    await waitForNoManagedEndpoints(api);
    await context.close();
  });

  test("K8s l20-2 with sglang:v0.5.10 covers vGPU, fractional, and full-card boundaries", async ({
    apiHelper,
    page,
  }) => {
    test.setTimeout(45 * 60_000);
    const endpoints = new ResourcePage(page, {
      routeName: "endpoints",
      workspaced: true,
      workspace: WORKSPACE,
    });

    await createL20Endpoint(endpoints);
    await waitForEndpointResources(apiHelper, L20_ENDPOINT, 30 * 60_000);

    await assertL20CreateBoundaries(endpoints);
    await assertL20EditBackfillAndSaveFullCard(endpoints, apiHelper);
    await assertL20FullCardBlockedAfterOccupation(endpoints);
  });

  test("SSH sshgpu-old with vllm:v0.17.1 covers fractional edit and full-card occupation", async ({
    apiHelper,
    page,
  }) => {
    test.setTimeout(45 * 60_000);
    const endpoints = new ResourcePage(page, {
      routeName: "endpoints",
      workspaced: true,
      workspace: WORKSPACE,
    });

    await createSshHalfGpuEndpoint(endpoints);
    await waitForEndpointResources(apiHelper, SSH_ENDPOINT, 30 * 60_000);

    await assertSshCreateFullBlockedAfterHalfOccupation(endpoints);
    await assertSshEditAndSaveFullCard(endpoints, apiHelper);
    await assertSshCreateFullBlockedAfterFullOccupation(endpoints);
  });
});

async function createL20Endpoint(endpoints: ResourcePage): Promise<void> {
  await openCreate(endpoints);
  await fillCommonEndpointFields(endpoints.page, {
    name: L20_ENDPOINT,
    cluster: "l20-2",
    accelerator: "NVIDIA-L20",
    engine: "sglang",
    engineVersion: "v0.5.10",
  });
  await setNumber(endpoints.page, "spec.resources.gpu", "2");
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "30",
  );
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.core_percent",
    "0",
  );
  await expectSaveEnabled(endpoints.page, "l20 create vGPU gpu=2 VRAM=30GiB", {
    cardCount: "2.0 / 2.0",
  });
  await submitAndExpect(endpoints.page, "POST", (payload) => {
    expectVgpuMemoryPayload(payload, 30 * 1024);
  });
}

async function assertL20CreateBoundaries(
  endpoints: ResourcePage,
): Promise<void> {
  await openCreate(endpoints);
  await fillCommonEndpointFields(endpoints.page, {
    name: "neu509-l20-blocked",
    cluster: "l20-2",
    accelerator: "NVIDIA-L20",
    engine: "sglang",
    engineVersion: "v0.5.10",
  });

  await setNumber(endpoints.page, "spec.resources.gpu", "1");
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "30",
  );
  await setNumber(endpoints.page, "spec.replicas.num", "3");
  await expectSaveDisabled(
    endpoints.page,
    "l20 create vGPU 3 replicas blocks",
    {
      cardCount: "0.0 / 0.0",
    },
  );

  await setNumber(endpoints.page, "spec.replicas.num", "1");
  await setNumber(endpoints.page, "spec.resources.gpu", "4");
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "20",
  );
  await expectSaveDisabled(endpoints.page, "l20 create 4-card 20GiB blocks", {
    cardCount: "0.0 / 0.0",
  });

  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "0",
  );
  await setNumber(endpoints.page, "spec.resources.gpu", "0.3");
  await expectSaveEnabled(endpoints.page, "l20 fractional gpu=0.3 allowed", {
    cardCount: "0.3 / 2.0",
  });

  await setNumber(endpoints.page, "spec.resources.gpu", "0.5");
  await expectSaveDisabled(endpoints.page, "l20 fractional gpu=0.5 blocks", {
    cardCount: "0.0 / 0.0",
  });

  await setNumber(endpoints.page, "spec.resources.gpu", "0.3");
  await setNumber(endpoints.page, "spec.resources.cpu", "999");
  await expectSaveDisabled(endpoints.page, "l20 CPU over limit disables Save");
  await setNumber(endpoints.page, "spec.resources.cpu", "1");
  await setNumber(endpoints.page, "spec.resources.memory", "999");
  await expectSaveDisabled(
    endpoints.page,
    "l20 memory over limit disables Save",
  );
}

async function assertL20EditBackfillAndSaveFullCard(
  endpoints: ResourcePage,
  api: ApiHelper,
): Promise<void> {
  await openEdit(endpoints, L20_ENDPOINT);
  await setNumber(endpoints.page, "spec.resources.gpu", "2");
  await setNumber(endpoints.page, "spec.replicas.num", "1");
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "30",
  );
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.core_percent",
    "0",
  );
  await expectSaveEnabled(endpoints.page, "l20 edit vGPU 2x30 allowed", {
    cardCount: "2.0 / 2.0",
  });

  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "45",
  );
  await expectSaveEnabled(endpoints.page, "l20 edit vGPU 2x45 allowed", {
    cardCount: "2.0 / 2.0",
  });
  await submitAndExpect(endpoints.page, "PATCH", (payload) => {
    expectVgpuMemoryPayload(payload, L20_DEVICE_MEMORY_MIB);
  });
  await waitForEndpointResources(api, L20_ENDPOINT, 30 * 60_000);

  await openEdit(endpoints, L20_ENDPOINT);
  await setNumber(endpoints.page, "spec.resources.gpu", "2");
  await setNumber(endpoints.page, "spec.replicas.num", "1");

  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "46",
  );
  await expectSaveDisabled(endpoints.page, "l20 edit vGPU 2x46 blocks", {
    cardCount: "0.0 / 0.0",
  });

  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "20",
  );
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.core_percent",
    "50",
  );
  await setNumber(endpoints.page, "spec.resources.gpu", "4");
  await expectSaveEnabled(
    endpoints.page,
    "l20 edit vGPU 4x20 core=50 allowed by per-device slots",
    { cardCount: "2.0 / 2.0" },
  );

  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.core_percent",
    "60",
  );
  await expectSaveDisabled(
    endpoints.page,
    "l20 edit vGPU 4x20 core=60 blocks by per-device slots",
    { cardCount: "2.0 / 2.0" },
  );

  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "30",
  );
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.core_percent",
    "0",
  );
  await setNumber(endpoints.page, "spec.resources.gpu", "2");
  await setNumber(endpoints.page, "spec.replicas.num", "2");
  await expectSaveDisabled(endpoints.page, "l20 edit 2 replicas gpu=2 blocks", {
    cardCount: "2.0 / 2.0",
  });

  await setNumber(endpoints.page, "spec.resources.gpu", "1");
  await expectSaveEnabled(endpoints.page, "l20 edit 2 replicas gpu=1 allowed", {
    cardCount: "2.0 / 2.0",
  });

  await setNumber(endpoints.page, "spec.replicas.num", "3");
  await expectSaveDisabled(endpoints.page, "l20 edit 3 replicas gpu=1 blocks", {
    cardCount: "2.0 / 2.0",
  });

  await setNumber(endpoints.page, "spec.replicas.num", "1");
  await setNumber(endpoints.page, "spec.resources.gpu", "2");
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "0",
  );
  await expectSaveEnabled(endpoints.page, "l20 convert to full-card allowed", {
    cardCount: "2.0 / 2.0",
  });
  await submitAndExpect(endpoints.page, "PATCH", (payload) => {
    expectNoVgpuMemoryPayload(payload);
  });
  await waitForEndpointResources(api, L20_ENDPOINT, 30 * 60_000);

  await openEdit(endpoints, L20_ENDPOINT);
  await setNumber(endpoints.page, "spec.resources.gpu", "2");
  await setNumber(endpoints.page, "spec.replicas.num", "2");
  await expectSaveDisabled(
    endpoints.page,
    "l20 full-card edit replicas=2 blocks",
    { cardCount: "2.0 / 2.0" },
  );
}

async function assertL20FullCardBlockedAfterOccupation(
  endpoints: ResourcePage,
): Promise<void> {
  await openCreate(endpoints);
  await fillCommonEndpointFields(endpoints.page, {
    name: "neu509-l20-blocked",
    cluster: "l20-2",
    accelerator: "NVIDIA-L20",
    engine: "sglang",
    engineVersion: "v0.5.10",
  });
  await setNumber(
    endpoints.page,
    "spec.resources.accelerator.virtualization.memory_mib",
    "0",
  );

  await setNumber(endpoints.page, "spec.resources.gpu", "1");
  await expectSaveDisabled(
    endpoints.page,
    "l20 full-card create gpu=1 blocks",
    {
      cardCount: "0.0 / 0.0",
    },
  );

  await setNumber(endpoints.page, "spec.resources.gpu", "2");
  await expectSaveDisabled(
    endpoints.page,
    "l20 full-card create gpu=2 blocks",
    {
      cardCount: "0.0 / 0.0",
    },
  );
}

async function createSshHalfGpuEndpoint(
  endpoints: ResourcePage,
): Promise<void> {
  await openCreate(endpoints);
  await fillCommonEndpointFields(endpoints.page, {
    name: SSH_ENDPOINT,
    cluster: "sshgpu-old",
    accelerator: "NVIDIA_Tesla_T4",
    engine: "vllm",
    engineVersion: "v0.17.1",
  });
  await setNumber(endpoints.page, "spec.resources.gpu", "0.5");
  await expectSaveEnabled(endpoints.page, "ssh create gpu=0.5 allowed", {
    cardCount: "0.5 / 1.0",
  });
  await submitAndExpect(endpoints.page, "POST");
}

async function assertSshCreateFullBlockedAfterHalfOccupation(
  endpoints: ResourcePage,
): Promise<void> {
  await openCreate(endpoints);
  await fillCommonEndpointFields(endpoints.page, {
    name: "neu509-ssh-blocked",
    cluster: "sshgpu-old",
    accelerator: "NVIDIA_Tesla_T4",
    engine: "vllm",
    engineVersion: "v0.17.1",
  });
  await setNumber(endpoints.page, "spec.resources.gpu", "1");
  await expectSaveDisabled(
    endpoints.page,
    "ssh create full gpu=1 blocks after half-card occupation",
    { cardCount: "0.0 / 0.0" },
  );
}

async function assertSshEditAndSaveFullCard(
  endpoints: ResourcePage,
  api: ApiHelper,
): Promise<void> {
  await openEdit(endpoints, SSH_ENDPOINT);

  await setNumber(endpoints.page, "spec.resources.gpu", "0.5");
  await setNumber(endpoints.page, "spec.replicas.num", "1");
  await expectSaveEnabled(endpoints.page, "ssh edit gpu=0.5 allowed", {
    cardCount: "0.5 / 1.0",
  });

  await setNumber(endpoints.page, "spec.resources.gpu", "1");
  await expectSaveEnabled(endpoints.page, "ssh edit gpu=1 allowed", {
    cardCount: "1.0 / 1.0",
  });

  await setNumber(endpoints.page, "spec.resources.gpu", "1.5");
  await expectSaveDisabled(endpoints.page, "ssh edit gpu=1.5 blocks", {
    cardCount: "1.0 / 1.0",
  });

  await setNumber(endpoints.page, "spec.resources.gpu", "1");
  await expectSaveEnabled(endpoints.page, "ssh convert to full-card allowed", {
    cardCount: "1.0 / 1.0",
  });
  await submitAndExpect(endpoints.page, "PATCH");
  await waitForEndpointResources(api, SSH_ENDPOINT, 30 * 60_000);

  await openEdit(endpoints, SSH_ENDPOINT);
  await setNumber(endpoints.page, "spec.resources.gpu", "1");
  await setNumber(endpoints.page, "spec.replicas.num", "1");
  await expectSaveEnabled(endpoints.page, "ssh full-card edit gpu=1 allowed", {
    cardCount: "1.0 / 1.0",
  });

  await setNumber(endpoints.page, "spec.replicas.num", "2");
  await expectSaveDisabled(
    endpoints.page,
    "ssh full-card edit replicas=2 blocks",
    { cardCount: "1.0 / 1.0" },
  );

  await setNumber(endpoints.page, "spec.replicas.num", "1");
  await setNumber(endpoints.page, "spec.resources.gpu", "1.5");
  await expectSaveDisabled(
    endpoints.page,
    "ssh full-card edit gpu=1.5 blocks",
    {
      cardCount: "1.0 / 1.0",
    },
  );
}

async function assertSshCreateFullBlockedAfterFullOccupation(
  endpoints: ResourcePage,
): Promise<void> {
  await openCreate(endpoints);
  await fillCommonEndpointFields(endpoints.page, {
    name: "neu509-ssh-blocked",
    cluster: "sshgpu-old",
    accelerator: "NVIDIA_Tesla_T4",
    engine: "vllm",
    engineVersion: "v0.17.1",
  });

  await setNumber(endpoints.page, "spec.resources.gpu", "1");
  await expectSaveDisabled(
    endpoints.page,
    "ssh create gpu=1 blocks after full-card occupation",
    { cardCount: "0.0 / 0.0" },
  );

  await setNumber(endpoints.page, "spec.resources.gpu", "2");
  await expectSaveDisabled(
    endpoints.page,
    "ssh create gpu=2 blocks after full-card occupation",
    { cardCount: "0.0 / 0.0" },
  );
}

async function fillCommonEndpointFields(
  page: Page,
  options: {
    name: string;
    cluster: string;
    accelerator: string;
    engine: string;
    engineVersion: string;
  },
): Promise<void> {
  await setText(page, "metadata.name", options.name);
  await selectComboboxContaining(page, "spec.model.registry", MODEL_REGISTRY);
  await selectComboboxContaining(page, "spec.model.name", MODEL_NAME);
  await expandAdvancedSettings(page);
  await selectComboboxContaining(page, "spec.engine.engine", options.engine);
  await selectComboboxContaining(
    page,
    "spec.engine.version",
    options.engineVersion,
  );
  await selectComboboxContaining(page, "spec.cluster", options.cluster);
  await selectComboboxContaining(
    page,
    "spec.resources.accelerator",
    options.accelerator,
  );
}

async function openCreate(endpoints: ResourcePage): Promise<void> {
  await endpoints.page.goto(`/#/${WORKSPACE}/endpoints/create`, {
    waitUntil: "domcontentloaded",
  });
  await endpoints.page
    .locator('[data-testid="form"]')
    .waitFor({ state: "visible" });
}

async function openEdit(
  endpoints: ResourcePage,
  endpointName: string,
): Promise<void> {
  await endpoints.page.goto(`/#/${WORKSPACE}/endpoints/edit/${endpointName}`, {
    waitUntil: "domcontentloaded",
  });
  await endpoints.page
    .locator('[data-testid="form"]')
    .waitFor({ state: "visible" });
  await expect(
    endpoints.page.locator('[data-testid="form-submit"]'),
  ).toBeEnabled({ timeout: 60_000 });
}

async function expandAdvancedSettings(page: Page): Promise<void> {
  const engineField = page.locator('[data-testid="field-spec.engine.engine"]');
  if (await engineField.isVisible()) return;

  const button = page.getByRole("button", {
    name: /customize settings|configuration details/i,
  });
  await button.click();
  await expect(engineField).toBeVisible({ timeout: 10_000 });
}

async function setText(
  page: Page,
  fieldName: string,
  value: string,
): Promise<void> {
  const input = page
    .locator(`[data-testid="field-${fieldName}"] input`)
    .first();
  await input.click();
  await input.clear();
  await input.fill(value);
  await input.blur();
}

async function setNumber(
  page: Page,
  fieldName: string,
  value: string,
): Promise<void> {
  const input = page
    .locator(`[data-testid="field-${fieldName}"] input`)
    .first();
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.click();
  await input.clear();
  await input.fill(value);
  await input.blur();
  await page.waitForTimeout(200);
}

async function selectComboboxContaining(
  page: Page,
  fieldName: string,
  optionText: string,
): Promise<void> {
  const field = page.locator(`[data-testid="field-${fieldName}"]`);
  await expect(field).toBeVisible({ timeout: 30_000 });
  await field.locator("button").click();
  const dialog = page.locator('[data-state="open"][role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const option = dialog.getByRole("option").filter({ hasText: optionText });
  await expect(option.first()).toBeVisible({ timeout: 30_000 });
  await option.first().click();
}

type CurrentRequestExpectation = {
  cardCount?: string;
};

async function expectSaveEnabled(
  page: Page,
  label: string,
  expectation?: CurrentRequestExpectation,
): Promise<void> {
  await expect(page.locator('[data-testid="form-submit"]'), label).toBeEnabled({
    timeout: 15_000,
  });
  if (expectation?.cardCount) {
    await expectCardCount(page, expectation.cardCount);
  }
  await logCurrentRequest(page, label);
}

async function expectSaveDisabled(
  page: Page,
  label: string,
  expectation?: CurrentRequestExpectation,
): Promise<void> {
  await expect(page.locator('[data-testid="form-submit"]'), label).toBeDisabled(
    {
      timeout: 15_000,
    },
  );
  if (expectation?.cardCount) {
    await expectCardCount(page, expectation.cardCount);
  }
  await logCurrentRequest(page, label);
}

async function submitAndExpect(
  page: Page,
  method: "POST" | "PATCH",
  assertPayload?: (payload: unknown) => void,
) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/endpoints") &&
      response.request().method() === method &&
      (response.ok() || response.status() >= 400),
    { timeout: 60_000 },
  );
  await page.locator('[data-testid="form-submit"]').click();
  const response = await responsePromise;
  if (assertPayload) {
    assertPayload(response.request().postDataJSON());
  }
  const body = await response.text().catch(() => "");
  expect(
    response.ok(),
    `${method} /endpoints failed with ${response.status()}: ${body}`,
  ).toBeTruthy();
}

async function expectCardCount(page: Page, expected: string): Promise<void> {
  const text = await currentRequestText(page);
  expect(text.replace(/\s+/g, " ")).toContain(`Card Count ${expected}`);
}

async function logCurrentRequest(page: Page, label: string): Promise<void> {
  const text = await currentRequestText(page).catch(() => "");
  console.log(`[NEU-509] ${label}${text ? ` :: ${text}` : ""}`);
}

async function currentRequestText(page: Page): Promise<string> {
  const grid = page.locator('[data-testid="endpoint-current-request-grid"]');
  return grid.innerText({ timeout: 2_000 });
}

function expectVgpuMemoryPayload(
  payload: unknown,
  expectedMemoryMiB: number,
): void {
  const accelerator = getPayloadAccelerator(payload);
  expect(JSON.stringify(payload)).not.toContain("memory_percent");
  expect(accelerator?.["virtualization.memory_mib"]).toBe(
    String(expectedMemoryMiB),
  );
  expect(accelerator).not.toHaveProperty("virtualization.memory_percent");
}

function expectNoVgpuMemoryPayload(payload: unknown): void {
  const accelerator = getPayloadAccelerator(payload);
  expect(JSON.stringify(payload)).not.toContain("memory_percent");
  expect(accelerator).not.toHaveProperty("virtualization.memory_mib");
  expect(accelerator).not.toHaveProperty("virtualization.memory_percent");
}

function getPayloadAccelerator(
  payload: unknown,
): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const spec = (payload as { spec?: unknown }).spec;
  if (!spec || typeof spec !== "object") return undefined;
  const resources = (spec as { resources?: unknown }).resources;
  if (!resources || typeof resources !== "object") return undefined;
  const accelerator = (resources as { accelerator?: unknown }).accelerator;
  if (!accelerator || typeof accelerator !== "object") return undefined;
  return accelerator as Record<string, unknown>;
}

async function waitForEndpointResources(
  api: ApiHelper,
  name: string,
  timeoutMs: number,
): Promise<void> {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < timeoutMs) {
    const endpoint = await getEndpoint(api, name);
    const phase = endpoint?.status?.phase ?? "missing";
    const hasDevices =
      endpoint?.status?.resources?.replicas?.some(
        (replica) => (replica.devices?.length ?? 0) > 0,
      ) ?? false;
    lastStatus = `${phase}, devices=${hasDevices}`;
    if (phase === "Running" && hasDevices) {
      console.log(`[NEU-509] ${name} Running with status.resources devices`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(
    `${name} did not become Running with resources: ${lastStatus}`,
  );
}

async function getEndpoint(
  api: ApiHelper,
  name: string,
): Promise<EndpointRecord | undefined> {
  const response = await api.request<EndpointRecord[]>(
    "GET",
    `/endpoints?metadata->>name=eq.${name}`,
  );
  if (!response.ok) {
    throw new Error(`GET endpoint ${name} failed with ${response.status}`);
  }
  return response.body[0];
}

async function listEndpointNames(api: ApiHelper): Promise<string[]> {
  const response = await api.request<EndpointRecord[]>("GET", "/endpoints");
  if (!response.ok) {
    throw new Error(`GET endpoints failed with ${response.status}`);
  }
  return response.body
    .map((endpoint) => endpoint.metadata?.name)
    .filter((name): name is string => Boolean(name));
}

async function deleteAllEndpoints(api: ApiHelper): Promise<void> {
  const names = await listEndpointNames(api);
  await Promise.all(
    names.map((name) =>
      api.deleteEndpoint(name, { force: true }).catch(() => {}),
    ),
  );
}

async function waitForNoManagedEndpoints(api: ApiHelper): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 240_000) {
    const names = await listEndpointNames(api);
    const remaining = names.filter(
      (name) =>
        managedEndpointNames.includes(name) || name.startsWith("neu509-"),
    );
    if (remaining.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("managed NEU-509 endpoints were not deleted in time");
}
