import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type FieldValues, FormProvider, useForm } from "react-hook-form";
import { afterEach, expect, it, vi } from "vitest";
import type { EndpointClusterRef } from "../types";
import { EndpointKVCacheFields } from "./EndpointKVCacheFields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
  engineVersion = "v0.31.0",
  runtimeVersion,
  configuredVersion,
}: {
  cache: unknown;
  engineVersion?: string;
  runtimeVersion?: string;
  configuredVersion?: string;
  save: (value: unknown) => void;
}) {
  const form = useForm<FieldValues>({
    defaultValues: {
      spec: {
        kv_cache: cache,
        engine: { engine: "vllm", version: engineVersion },
      },
    },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save)}>
        <EndpointKVCacheFields
          form={form}
          isEdit
          cluster={
            {
              metadata: { name: "test" },
              status: {
                cache: {
                  details: {
                    configured_runtime_version: configuredVersion,
                    ready_runtime_version: "v0.5.0",
                  },
                },
              },
              spec: {
                type: "kubernetes",
                cache: {
                  provider: "zcache",
                  options: {
                    enabled: true,
                    target_nodes: ["a"],
                    version: runtimeVersion,
                  },
                },
              },
            } as unknown as EndpointClusterRef
          }
        />
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

vi.mock("@/foundation/hooks/use-cache-versions", () => ({
  useCacheVersions: () => ({
    data: {
      data: [
        { version: "v0.5.5", engine_versions: ["v0.31.0"] },
        { version: "v0.5.0", engine_versions: ["v0.24.0"] },
      ],
    },
  }),
}));

it.each([
  [undefined, undefined, "v0.24.0", true],
  [undefined, "v0.5.0", "v0.24.0", false],
  ["v0.5.5", "v0.5.0", "v0.24.0", true],
  ["v0.5.5", "v0.5.0", "v0.31.0", false],
])(
  "uses target then configured then default version (%s, %s, %s)",
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
