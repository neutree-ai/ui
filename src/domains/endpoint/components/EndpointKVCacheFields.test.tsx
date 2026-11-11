import { fireEvent, render, screen } from "@testing-library/react";
import { type FieldValues, FormProvider, useForm } from "react-hook-form";
import { beforeEach, expect, it, vi } from "vitest";
import { useKvCacheAvailability } from "@/domains/endpoint/hooks/use-kv-cache-availability";
import { endpointValuesEqual } from "@/domains/endpoint/lib/endpoint-review-changes";
import { useCacheVersions } from "@/foundation/hooks/use-cache-versions";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import type { EndpointClusterRef } from "../types";
import { EndpointKVCacheFields } from "./EndpointKVCacheFields";

vi.mock("@/foundation/hooks/use-system-api", () => ({ useSystemApi: vi.fn() }));
vi.mock("@/foundation/hooks/use-cache-versions", () => ({
  useCacheVersions: vi.fn(),
}));

const systemWith = (providers: string[]) =>
  ({
    systemInfo: { capabilities: { cluster_cache_providers: providers } },
  }) as unknown as ReturnType<typeof useSystemApi>;

beforeEach(() => {
  vi.mocked(useSystemApi).mockReturnValue(systemWith(["zcache"]));
  vi.mocked(useCacheVersions).mockReturnValue({
    isLoading: false,
    isError: false,
    data: { data: [{ version: "v0.5.6", engine_versions: ["v0.32.0"] }] },
  } as unknown as ReturnType<typeof useCacheVersions>);
});

const makeCluster = ({
  enabled = true,
  phase = "Ready",
  error,
}: {
  enabled?: boolean;
  phase?: string;
  error?: string;
} = {}) =>
  ({
    metadata: { name: "test" },
    status: {
      cache: {
        phase,
        error_message: error,
        details: { current: { l1_size_gib: 8 } },
      },
    },
    spec: {
      type: "kubernetes",
      cache: { provider: "zcache", options: { enabled, version: "v0.5.6" } },
    },
  }) as unknown as EndpointClusterRef;

function Editor({
  cache,
  cluster = makeCluster(),
  save = vi.fn(),
}: {
  cache: unknown;
  cluster?: EndpointClusterRef | null;
  save?: (value: FieldValues) => void;
}) {
  const form = useForm<FieldValues>({
    defaultValues: { spec: { kv_cache: cache } },
  });
  const availability = useKvCacheAvailability({
    cluster: cluster ?? undefined,
    acceleratorType: "nvidia_gpu",
    engine: { engine: "vllm", version: "v0.32.0" },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save)}>
        <EndpointKVCacheFields
          form={form}
          isEdit
          cacheChanged={
            !endpointValuesEqual(form.watch("spec.kv_cache"), cache)
          }
          availability={availability}
          cluster={cluster ?? undefined}
        />
        <button type="submit">save</button>
      </form>
    </FormProvider>
  );
}

const zcache = { provider: "zcache", options: { timeout_seconds: 5 } };

async function submit(save: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByText("save"));
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  return save.mock.calls[0][0].spec.kv_cache;
}

it("preserves a backend-only provider without offering cache controls", async () => {
  const save = vi.fn();
  const cache = { provider: "vllm-native", options: { cpu_memory_gib: 0.25 } };
  render(<Editor cache={cache} save={save} />);
  expect(screen.queryByRole("switch")).toBeNull();
  expect(await submit(save)).toEqual(cache);
});

it("hides disabled cache controls when the backend has no cache provider", () => {
  vi.mocked(useSystemApi).mockReturnValue(systemWith([]));
  render(<Editor cache={null} />);
  expect(screen.queryByRole("switch")).toBeNull();
});

it("enables cache with its provider and default timeout", async () => {
  const save = vi.fn();
  render(<Editor cache={null} save={save} />);
  fireEvent.click(screen.getByRole("switch"));
  screen.getByRole("spinbutton");
  expect(await submit(save)).toEqual({
    provider: "zcache",
    options: { timeout_seconds: 5 },
  });
});

it("disables the switch and explains why when cache is unavailable", () => {
  render(<Editor cache={null} cluster={makeCluster({ enabled: false })} />);
  expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  screen.getByText("endpoints.kvCacheSettings.unavailableCluster");
});

it("saves a valid timeout", async () => {
  const save = vi.fn();
  render(<Editor cache={zcache} save={save} />);
  fireEvent.change(screen.getByRole("spinbutton"), {
    target: { value: "1.5" },
  });
  expect(await submit(save)).toEqual({
    provider: "zcache",
    options: { timeout_seconds: 1.5 },
  });
});

it("clears the redeploy warning when cache returns to its persisted value", () => {
  render(<Editor cache={null} />);
  fireEvent.click(screen.getByRole("switch"));
  screen.getByText("endpoints.kvCacheSettings.redeploy");
  fireEvent.click(screen.getByRole("switch"));
  expect(screen.queryByText("endpoints.kvCacheSettings.redeploy")).toBeNull();
});

it("shows manager health and L1 capacity", () => {
  render(<Editor cache={null} />);
  screen.getByText("endpoints.kvCacheSettings.managerReady");
  screen.getByText("endpoints.kvCacheSettings.l1Capacity:8");
});

it("shows the manager error returned by the selected cluster", () => {
  render(
    <Editor
      cache={null}
      cluster={makeCluster({
        phase: "Failed",
        error: "cache manager could not reconcile",
      })}
    />,
  );
  screen.getByText("cache manager could not reconcile");
});

it("localizes the reconciling phase in pending manager messages", () => {
  render(
    <Editor cache={null} cluster={makeCluster({ phase: "Reconciling" })} />,
  );
  expect(
    screen.getAllByText(
      "endpoints.kvCacheSettings.managerPending:endpoints.kvCacheSettings.phases.Reconciling",
    ).length,
  ).toBeGreaterThanOrEqual(2);
});

async function openConfig() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "endpoints.kvCacheSettings.viewConfig",
    }),
  );
  return (await screen.findByRole("dialog")).textContent;
}

it("opens a read-only cache configuration summary", async () => {
  render(<Editor cache={zcache} />);
  const dialog = await openConfig();
  expect(dialog).toContain("endpoints.kvCacheSettings.providerZCache");
  expect(dialog).toContain("test");
  expect(dialog).toContain("endpoints.kvCacheSettings.platformManaged");
});

it("identifies a missing cluster in the cache configuration", async () => {
  render(<Editor cache={zcache} cluster={null} />);
  expect(await openConfig()).toContain(
    "endpoints.kvCacheSettings.clusterNotSelected",
  );
});

it("states that there is no cache configuration while disabled", async () => {
  render(<Editor cache={null} />);
  expect(await openConfig()).toContain("endpoints.kvCacheSettings.noConfig");
});
