import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { useForm, FormProvider, type FieldValues } from "react-hook-form";
import { afterEach, expect, it, vi } from "vitest";
import type { EndpointClusterRef } from "../types";
import { EndpointZCacheFields } from "./EndpointZCacheFields";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/foundation/hooks/use-system-api", () => ({ useSystemApi: () => ({ systemInfo: { capabilities: { zcache: true } } }) }));
afterEach(cleanup);

function Editor({ cache, save }: { cache: unknown; save: (value: unknown) => void }) {
  const form = useForm<FieldValues>({ defaultValues: { spec: { kv_cache: cache, engine: { engine: "vllm" } } } });
  return <FormProvider {...form}><form onSubmit={form.handleSubmit(save)}>
    <EndpointZCacheFields form={form} isEdit cluster={{ metadata: { name: "test" }, spec: { type: "kubernetes", zcache: { enabled: true, target_nodes: ["a"] } } } as EndpointClusterRef} />
    <button type="submit">save</button>
  </form></FormProvider>;
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
  render(<Editor cache={{ provider: "zcache", options: { timeout_seconds: 2 } }} save={save} />);
  fireEvent.click(screen.getByRole("switch"));
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].spec.kv_cache).toBeNull();
});
