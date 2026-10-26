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
  supportedCluster = true,
  invalid,
}: {
  cache: unknown;
  save: (value: unknown) => void;
  supportedCluster?: boolean;
  invalid?: (value: unknown) => void;
}) {
  const form = useForm<FieldValues>({
    defaultValues: { spec: { kv_cache: cache, engine: { engine: "vllm" } } },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save, invalid)}>
        <EndpointKVCacheFields
          form={form}
          isEdit
          cluster={
            {
              metadata: { name: "test" },
              spec: {
                type: "kubernetes",
                cache: {
                  provider: "zcache",
                  options: { enabled: supportedCluster, target_nodes: ["a"] },
                },
              },
            } as unknown as EndpointClusterRef
          }
        />
        <button type="button" onClick={() => form.setValue("spec.engine.engine", "sglang")}>change engine</button>
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
  const { rerender } = render(<Editor cache={cache} save={save} invalid={invalid} />);
  rerender(<Editor cache={cache} save={save} invalid={invalid} supportedCluster={false} />);
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
  render(<Editor cache={{ provider: "zcache" }} save={save} invalid={invalid} />);
  fireEvent.click(screen.getByText("change engine"));
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(invalid).toHaveBeenCalled());
  expect(save).not.toHaveBeenCalled();
});
