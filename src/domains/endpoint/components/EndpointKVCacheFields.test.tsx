import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { type FieldValues, FormProvider, useForm } from "react-hook-form";
import { afterEach, expect, it, vi } from "vitest";
import { endpointValuesEqual } from "@/domains/endpoint/lib/endpoint-review-changes";
import type { EndpointClusterRef } from "../types";
import { EndpointKVCacheFields } from "./EndpointKVCacheFields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { phase?: string }) =>
      options?.phase ? `${key}:${options.phase}` : key,
  }),
}));
vi.mock("@/foundation/hooks/use-system-api", () => ({
  useSystemApi: () => ({
    systemInfo: { capabilities: { cluster_cache_providers: ["zcache"] } },
  }),
}));
afterEach(cleanup);

function Editor({
  cache,
  save,
  supportedCluster = true,
  invalid,
  engineVersion = "v0.32.0-zcache-enabled",
  runtimeVersion = "v0.5.6-post.1",
  configuredVersion,
  cacheStatusLoading = false,
  acceleratorType = "nvidia_gpu",
  cachePhase = "Ready",
  sectioned = false,
}: {
  cache: unknown;
  engineVersion?: string;
  runtimeVersion?: string;
  configuredVersion?: string;
  cacheStatusLoading?: boolean;
  acceleratorType?: string;
  cachePhase?: string;
  sectioned?: boolean;
  save: (value: unknown) => void;
  supportedCluster?: boolean;
  invalid?: (value: unknown) => void;
}) {
  const form = useForm<FieldValues>({
    defaultValues: {
      spec: {
        kv_cache: cache,
        engine: { engine: "vllm", version: engineVersion },
      },
    },
  });
  const cacheChanged = !endpointValuesEqual(form.watch("spec.kv_cache"), cache);
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save, invalid)}>
        <EndpointKVCacheFields
          form={form}
          isEdit
          cacheChanged={cacheChanged}
          sectioned={sectioned}
          cacheStatusLoading={cacheStatusLoading}
          acceleratorType={acceleratorType}
          cluster={
            {
              metadata: { name: "test" },
              status: {
                cache: {
                  phase: cachePhase,
                  details: {
                    ready_runtime_version: "v0.5.0",
                    current: { l1_size_gib: 8 },
                  },
                },
              },
              spec: {
                type: "kubernetes",
                cache: {
                  provider: "zcache",
                  options: {
                    enabled: supportedCluster,
                    target_nodes: ["a"],
                    version: runtimeVersion,
                  },
                },
              },
            } as unknown as EndpointClusterRef
          }
        />
        <button
          type="button"
          onClick={() => form.setValue("spec.engine.engine", "sglang")}
        >
          change engine
        </button>
        <button
          type="button"
          onClick={() => form.setValue("spec.model.task", "text-embedding")}
        >
          change task
        </button>
        <output data-testid="engine-version">
          {form.watch("spec.engine.version")}
        </output>
        <button type="submit">save</button>
      </form>
    </FormProvider>
  );
}

it("preserves a backend-only provider without offering cache controls", async () => {
  const save = vi.fn();
  const cache = { provider: "vllm-native", options: { cpu_memory_gib: 0.25 } };
  render(<Editor cache={cache} save={save} />);
  expect(screen.queryByRole("switch")).toBeNull();
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].spec.kv_cache).toEqual(cache);
});

it("disables ZCache by clearing the provider configuration", async () => {
  const save = vi.fn();
  render(
    <Editor
      cache={{ provider: "zcache", options: { timeout_seconds: 2 } }}
      save={save}
    />,
  );
  fireEvent.click(screen.getByRole("switch"));
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].spec.kv_cache).toBeNull();
});

it("enables cache with its provider and default timeout without a selector", async () => {
  const save = vi.fn();
  render(<Editor cache={null} save={save} />);
  fireEvent.click(screen.getByRole("switch"));
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.getByRole("spinbutton")).toBeTruthy();
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].spec.kv_cache).toEqual({
    provider: "zcache",
    options: { timeout_seconds: 5 },
  });
});

it("saves the common timeout option and rejects values outside its range", async () => {
  const save = vi.fn();
  render(
    <Editor
      cache={{ provider: "zcache", options: { timeout_seconds: 5 } }}
      save={save}
    />,
  );
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "0" } });
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() =>
    expect(
      screen.getByText("endpoints.kvCacheSettings.invalidTimeout"),
    ).toBeTruthy(),
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("spinbutton"), {
    target: { value: "1.5" },
  });
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].spec.kv_cache).toEqual({
    provider: "zcache",
    options: { timeout_seconds: 1.5 },
  });
});

it("blocks cache submission after switching to an unsupported cluster, and permits disabling cache", async () => {
  const save = vi.fn();
  const invalid = vi.fn();
  const cache = { provider: "zcache", options: { timeout_seconds: 5 } };
  const { rerender } = render(
    <Editor cache={cache} save={save} invalid={invalid} />,
  );
  rerender(
    <Editor
      cache={cache}
      save={save}
      invalid={invalid}
      supportedCluster={false}
    />,
  );
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(invalid).toHaveBeenCalled());
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch"));
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].spec.kv_cache).toBeNull();
});

it("blocks ZCache after switching to a non-vLLM engine", async () => {
  const save = vi.fn();
  const invalid = vi.fn();
  render(
    <Editor cache={{ provider: "zcache" }} save={save} invalid={invalid} />,
  );
  fireEvent.click(screen.getByText("change engine"));
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(invalid).toHaveBeenCalled());
  expect(save).not.toHaveBeenCalled();
});

it("clears the redeploy warning when cache returns to its persisted value", () => {
  render(<Editor cache={null} save={vi.fn()} />);

  fireEvent.click(screen.getByRole("switch"));
  expect(screen.getByText("endpoints.kvCacheSettings.redeploy")).toBeTruthy();

  fireEvent.click(screen.getByRole("switch"));
  expect(screen.queryByText("endpoints.kvCacheSettings.redeploy")).toBeNull();
});

it("explains when the selected cluster does not provide ZCache", () => {
  render(<Editor cache={null} save={vi.fn()} supportedCluster={false} />);

  expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByTestId("endpoint-kv-cache-unavailable").textContent,
  ).toContain("endpoints.kvCacheSettings.unavailableCluster");
  expect(screen.queryByTestId("endpoint-kv-cache-manager-status")).toBeNull();
});

it("explains when the engine or task is incompatible", () => {
  render(<Editor cache={null} save={vi.fn()} />);

  fireEvent.click(screen.getByText("change engine"));
  expect(
    screen.getByTestId("endpoint-kv-cache-unavailable").textContent,
  ).toContain("endpoints.kvCacheSettings.unavailableEngine");

  cleanup();
  render(<Editor cache={null} save={vi.fn()} />);
  fireEvent.click(screen.getByText("change task"));
  expect(
    screen.getByTestId("endpoint-kv-cache-unavailable").textContent,
  ).toContain("endpoints.kvCacheSettings.unavailableTask");
});

it("keeps the selected engine version and explains when it is incompatible", () => {
  render(
    <Editor
      cache={null}
      save={vi.fn()}
      engineVersion="v0.24.0"
      runtimeVersion="v0.5.6-post.1"
    />,
  );

  const cacheSwitch = screen.getByRole("switch");
  expect(cacheSwitch.hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByTestId("endpoint-kv-cache-unavailable").textContent,
  ).toContain("endpoints.kvCacheSettings.unavailableEngineVersion");
  expect(screen.getByTestId("engine-version").textContent).toBe("v0.24.0");
});

it("blocks an already-enabled cache with an incompatible engine version", async () => {
  const save = vi.fn();
  const invalid = vi.fn();
  render(
    <Editor
      cache={{ provider: "zcache", options: { timeout_seconds: 5 } }}
      save={save}
      invalid={invalid}
      engineVersion="v0.24.0"
      runtimeVersion="v0.5.6-post.1"
    />,
  );

  expect(
    screen.getByTestId("endpoint-kv-cache-unavailable").textContent,
  ).toContain("endpoints.kvCacheSettings.unavailableEngineVersion");
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(invalid).toHaveBeenCalled());
  expect(save).not.toHaveBeenCalled();
});

it("requires an NVIDIA accelerator before cache can be enabled", () => {
  render(<Editor cache={null} save={vi.fn()} acceleratorType="amd_gpu" />);

  expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByTestId("endpoint-kv-cache-unavailable").textContent,
  ).toContain("endpoints.kvCacheSettings.unavailableAcceleratorVendor");
});

it("shows manager health and L1 capacity before the switch", () => {
  render(<Editor cache={null} save={vi.fn()} sectioned />);

  const status = screen.getByTestId("endpoint-kv-cache-manager-status");
  expect(status.textContent).toContain(
    "endpoints.kvCacheSettings.managerReady",
  );
  expect(status.textContent).toContain("endpoints.kvCacheSettings.l1Capacity");
  expect(status.getAttribute("data-l1-capacity")).toBe("8");
});

it("disables cache while the manager is reconciling or unavailable", () => {
  render(<Editor cache={null} save={vi.fn()} cachePhase="Reconciling" />);

  expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByTestId("endpoint-kv-cache-unavailable").textContent,
  ).toContain("endpoints.kvCacheSettings.managerPending:Reconciling");

  cleanup();
  render(<Editor cache={null} save={vi.fn()} cachePhase="Failed" />);

  expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByTestId("endpoint-kv-cache-unavailable").textContent,
  ).toContain("endpoints.kvCacheSettings.managerUnavailable");
});

it("disables cache when no compatible engine version exists", () => {
  render(
    <Editor
      cache={null}
      save={vi.fn()}
      engineVersion="v0.99.0"
      runtimeVersion="v0.6.0-no-engine"
    />,
  );

  expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByTestId("endpoint-kv-cache-unavailable").textContent,
  ).toContain("endpoints.kvCacheSettings.noCompatibleEngineVersion");
});

it("allows clearing timeout but requires a valid number before saving", async () => {
  const save = vi.fn();
  const invalid = vi.fn();
  render(
    <Editor
      cache={{ provider: "zcache", options: { timeout_seconds: 5 } }}
      save={save}
      invalid={invalid}
    />,
  );
  const input = screen.getByRole("spinbutton") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.blur(input);
  expect(input.value).toBe("");
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(invalid).toHaveBeenCalled());
  expect(save).not.toHaveBeenCalled();
  expect(input.value).toBe("");
  fireEvent.change(input, { target: { value: "2.5" } });
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].spec.kv_cache.options.timeout_seconds).toBe(2.5);
});

it("blocks cache after switching to an embedding task and allows disabling it", async () => {
  const save = vi.fn();
  const invalid = vi.fn();
  render(
    <Editor
      cache={{ provider: "zcache", options: { timeout_seconds: 5 } }}
      save={save}
      invalid={invalid}
    />,
  );
  fireEvent.click(screen.getByText("change task"));
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(invalid).toHaveBeenCalled());
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch"));
  expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].spec.kv_cache).toBeNull();
});
vi.mock("@/foundation/hooks/use-cache-versions", () => ({
  useCacheVersions: () => ({
    data: {
      data: [
        {
          version: "v0.5.6-post.1",
          engine_versions: ["v0.32.0-zcache-enabled"],
          is_default: true,
        },
        { version: "v0.5.0", engine_versions: ["v0.24.0"] },
        { version: "v0.6.0-no-engine", engine_versions: [] },
      ],
    },
  }),
}));

it.each([
  ["", undefined, "v0.24.0", true],
  ["", "v0.5.0", "v0.24.0", true],
  ["v0.5.6-post.1", "v0.5.0", "v0.24.0", true],
  ["v0.5.6-post.1", "v0.5.0", "v0.32.0-zcache-enabled", false],
])(
  "uses only the persisted target version (%s, %s, %s)",
  (runtimeVersion, configuredVersion, engineVersion, disabled) => {
    render(
      <Editor
        cache={null}
        save={vi.fn()}
        runtimeVersion={runtimeVersion}
        configuredVersion={configuredVersion}
        engineVersion={engineVersion}
      />,
    );
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(
      disabled,
    );
  },
);
it("opens a read-only cache configuration summary", async () => {
  render(
    <Editor
      cache={{ provider: "zcache", options: { timeout_seconds: 5 } }}
      save={vi.fn()}
    />,
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "endpoints.kvCacheSettings.viewConfig",
    }),
  );

  const dialog = await screen.findByRole("dialog");
  expect(dialog.textContent).toContain("endpoints.kvCacheSettings.configTitle");
  expect(dialog.textContent).toContain(
    "endpoints.kvCacheSettings.providerZCache",
  );
  expect(dialog.textContent).toContain("test");
  expect(dialog.textContent).toContain(
    "endpoints.kvCacheSettings.platformManaged",
  );
});

it("states that there is no cache configuration while disabled", async () => {
  render(<Editor cache={null} save={vi.fn()} />);

  fireEvent.click(
    screen.getByRole("button", {
      name: "endpoints.kvCacheSettings.viewConfig",
    }),
  );

  expect((await screen.findByRole("dialog")).textContent).toContain(
    "endpoints.kvCacheSettings.noConfig",
  );
});

it("renders wizard cache controls as their own form section", () => {
  render(<Editor cache={null} save={vi.fn()} sectioned />);

  const section = screen.getByTestId("endpoint-kv-cache-section");
  const header = within(section).getByTestId("endpoint-kv-cache-header");
  expect(
    within(header).getByRole("heading", {
      name: "endpoints.sections.kvCache",
    }),
  ).toBeTruthy();
  expect(
    within(header).getByRole("button", {
      name: "endpoints.kvCacheSettings.viewConfig",
    }),
  ).toBeTruthy();
  expect(
    within(header).getByRole("button", {
      name: "endpoints.kvCacheSettings.scheduling",
    }),
  ).toBeTruthy();
  expect(
    within(header).queryByRole("switch", {
      name: "endpoints.kvCacheSettings.enable",
    }),
  ).toBeNull();
  const toggle = within(section).getByTestId("endpoint-kv-cache-toggle");
  expect(
    within(toggle).getByText("endpoints.kvCacheSettings.enableLabel"),
  ).toBeTruthy();
  expect(
    within(toggle).getByRole("switch", {
      name: "endpoints.kvCacheSettings.enable",
    }),
  ).toBeTruthy();
  expect(screen.queryByTestId("endpoint-kv-cache")).toBeNull();
});

it("toggles cache from the wizard form field", () => {
  render(<Editor cache={null} save={vi.fn()} sectioned />);

  const toggle = screen.getByTestId("endpoint-kv-cache-toggle");
  const cacheSwitch = within(toggle).getByRole("switch");
  fireEvent.click(cacheSwitch);

  expect(cacheSwitch.getAttribute("aria-checked")).toBe("true");
  const timeout = screen.getByTestId("endpoint-kv-cache-config");
  expect(within(timeout).getByRole("spinbutton")).toBeTruthy();
  expect(toggle.parentElement).toBe(timeout.parentElement);
});
