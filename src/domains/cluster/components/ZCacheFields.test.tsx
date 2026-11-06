import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { type FieldValues, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fillField } from "@/foundation/testing/interactions";
import { renderForm } from "@/foundation/testing/render-form";
import {
  CACHE_DEPENDENT_SELECT,
  type CacheDependentEndpoint,
} from "../lib/zcache-node-selection";
import type { ClusterCacheStatus, ZCacheStatus } from "../types";
import { ZCacheFields } from "./ZCacheFields";

const cacheDependencies = vi.hoisted(() => ({
  query: vi.fn(),
  rows: [] as CacheDependentEndpoint[],
}));
vi.mock("@refinedev/core", () => ({
  useList: (options: unknown) => {
    cacheDependencies.query(options);
    return {
      data: { data: cacheDependencies.rows },
      isLoading: false,
      isError: false,
    };
  },
}));
vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div role="tooltip">{children}</div>
  ),
}));
beforeEach(() => {
  cacheDependencies.rows = [];
  cacheDependencies.query.mockClear();
});

const saved = { enabled: true, l1_size_gib: 8, target_nodes: ["a", "b"] };
const observed: ZCacheStatus = {
  candidates: [
    { name: "a", selectable: true },
    { name: "b", selectable: false },
    { name: "c", selectable: true },
  ],
  nodes: [
    {
      name: "a",
      runtime: "Ready",
      cache: "Available",
      capacity_bytes: 8 * 2 ** 30,
    },
    {
      name: "b",
      runtime: "NotReady",
      cache: "Unavailable",
      capacity_bytes: 8 * 2 ** 30,
      reason: "cache runtime unavailable",
    },
  ],
};

function renderFields({
  status,
  summary,
  isEdit = true,
  legacy = false,
}: {
  status?: ZCacheStatus;
  summary?: ClusterCacheStatus;
  isEdit?: boolean;
  legacy?: boolean;
} = {}) {
  const { result } = renderForm(
    () => ({
      form: useForm<FieldValues>({
        defaultValues: {
          metadata: { name: "test-cluster", workspace: "default" },
          spec: {
            type: "kubernetes",
            config: {},
            cache: legacy ? undefined : { provider: "zcache", options: saved },
          },
        },
      }),
    }),
    ({ form }) => (
      <ZCacheFields
        form={form}
        isEdit={isEdit}
        status={status}
        summary={summary}
      />
    ),
  );
  const submit = async () => {
    const onValid = vi.fn();
    await act(() => result.current.form.handleSubmit(onValid)());
    return onValid.mock.calls[0]?.[0];
  };
  return { submit };
}

const lastQuery = () => cacheDependencies.query.mock.lastCall?.[0];
const checkbox = (name: string) => screen.getByRole("checkbox", { name });
const cacheSwitch = () =>
  screen.getByRole("switch", { name: "clusters.zcache.enable" });

describe("ZCacheFields", () => {
  it("blocks removal while endpoints still use cache, but allows expansion", () => {
    cacheDependencies.rows = [
      {
        id: 1,
        name: "endpoint-a",
        observed_kv_cache: { provider: "zcache", details: { in_use: true } },
      },
    ];
    renderFields({ status: observed });
    expect(checkbox("a")).toHaveProperty("disabled", true);
    expect(checkbox("c")).toHaveProperty("disabled", false);
    expect(cacheSwitch()).toHaveProperty("disabled", true);
    screen.getAllByText("clusters.zcache.dependencyCount:1");
    screen.getAllByText("endpoint-a");
    screen.getByText("cache runtime unavailable");
  });
  it("polls only the endpoint fields it needs, while saved or edited cache is enabled", async () => {
    renderFields({ legacy: true });
    expect(lastQuery().queryOptions.enabled).toBe(false);
    fireEvent.click(cacheSwitch());
    await waitFor(() => expect(lastQuery().queryOptions.enabled).toBe(true));
    expect(lastQuery().meta.select).toBe(CACHE_DEPENDENT_SELECT);
    fireEvent.click(cacheSwitch());
    await waitFor(() => expect(lastQuery().queryOptions.enabled).toBe(false));
  });
  it("keeps checking dependencies while disabling a saved cache configuration", () => {
    renderFields({ status: observed });
    fireEvent.click(cacheSwitch());
    expect(lastQuery().queryOptions.enabled).toBe(true);
  });
  it("labels the section with the resolved state, not the raw phase", () => {
    renderFields({
      status: { ...observed, current: { ...saved, l1_size_gib: 4 } },
      summary: { provider: "zcache", phase: "Ready", conditions: [] },
    });
    screen.getByText("clusters.zcache.reconciling");
  });
  it("sends a numeric capacity and preserves the successful node when removing a failed node", async () => {
    const { submit } = renderFields({ status: observed });
    fillField("spec.cache.options.l1_size_gib", "1");
    fireEvent.click(checkbox("b"));
    expect((await submit()).spec.cache.options).toEqual({
      enabled: true,
      l1_size_gib: 1,
      target_nodes: ["a"],
    });
  });
  it("filters the cache node table", () => {
    renderFields({ status: observed });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "clusters.zcache.searchNodes" }),
      { target: { value: "c" } },
    );
    expect(screen.queryByRole("checkbox", { name: "a" })).toBeNull();
    checkbox("c");
  });
  it("reports stale inventory and stops adding its candidates", () => {
    renderFields({ status: { ...observed, observation_error: "unavailable" } });
    expect(checkbox("c")).toHaveProperty("disabled", true);
    expect(screen.getByRole("alert").textContent).toContain("unavailable");
  });
  it("keeps invalid capacity visible with an explanation", async () => {
    renderFields({ status: observed });
    fillField("spec.cache.options.l1_size_gib", "1.5");
    expect(screen.getByRole("spinbutton")).toHaveProperty("value", "1.5");
    await screen.findByText("clusters.zcache.invalidCapacity");
  });
  it("rejects an empty node selection", async () => {
    const { submit } = renderFields({ status: observed });
    fireEvent.click(checkbox("a"));
    fireEvent.click(checkbox("b"));
    expect(await submit()).toBeUndefined();
    await screen.findByText("clusters.zcache.selectNodes");
  });
  it("can disable runtime even after clearing the target selection", async () => {
    const { submit } = renderFields({ status: observed });
    fireEvent.click(checkbox("a"));
    fireEvent.click(checkbox("b"));
    fireEvent.click(cacheSwitch());
    expect((await submit()).spec.cache.options.enabled).toBe(false);
  });
  it("explains bootstrap before enabling runtime on a new cluster", () => {
    renderFields({ isEdit: false });
    screen.getByText("clusters.zcache.createHint");
    expect(screen.queryByRole("switch")).toBeNull();
  });
  it("allows clearing capacity before entering a replacement", () => {
    renderFields();
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveProperty("value", "");
    fireEvent.change(input, { target: { value: "16" } });
    expect(input).toHaveProperty("value", "16");
  });
});
