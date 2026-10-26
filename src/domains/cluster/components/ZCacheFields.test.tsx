import type { UseFormReturnType } from "@refinedev/react-hook-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { transformClusterValues } from "../lib/transform-cluster-values";
import type { Cluster, ZCacheStatus } from "../types";
import { ZCacheFields } from "./ZCacheFields";

const cacheDependencies = vi.hoisted(() => ({
  query: vi.fn(),
  rows: [] as Array<{
    spec: { kv_cache?: { provider: string } | null };
    status?: { kv_cache?: { provider: string; details: { in_use: boolean } } };
  }>,
}));
vi.mock("@refinedev/core", () => ({
  useList: (options: unknown) => {
    cacheDependencies.query(options);
    return ({
    data: { data: cacheDependencies.rows },
    isLoading: false,
    isError: false,
  });
  },
}));
beforeEach(() => {
  cacheDependencies.rows = [];
  cacheDependencies.query.mockClear();
});

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function Form({
  onSubmit,
  status,
  isEdit = true,
  legacy = false,
}: {
  onSubmit: (data: Cluster) => void;
  status?: ZCacheStatus;
  isEdit?: boolean;
  legacy?: boolean;
}) {
  const form = useForm<Cluster>({
    defaultValues: {
      metadata: { name: "test-cluster", workspace: "default" },
      spec: {
        type: "kubernetes",
        config: {},
        cache: legacy
          ? undefined
          : {
              provider: "zcache",
              options: {
                enabled: true,
                l1_size_gib: 8,
                target_nodes: ["a", "b"],
              },
            },
      },
    },
  });
  const adapted = Object.assign(form, {
    refineCore: {
      query: {
        data: {
          data: { status: { cache: { provider: "zcache", details: status } } },
        },
      },
    },
  }) as unknown as UseFormReturnType<Cluster>;
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <ZCacheFields form={adapted} isEdit={isEdit} status={status} />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}
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
    },
  ],
};

describe("ZCacheFields", () => {
  it("blocks removal while old inference pods still use cache, but allows expansion", () => {
    cacheDependencies.rows = [
      {
        spec: { kv_cache: null },
        status: { kv_cache: { provider: "zcache", details: { in_use: true } } },
      },
    ];
    render(<Form onSubmit={vi.fn()} status={observed} />);
    expect(
      screen.getByRole("checkbox", { name: "a" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("checkbox", { name: "c" }).hasAttribute("disabled"),
    ).toBe(false);
    expect(
      screen
        .getByRole("checkbox", { name: "clusters.zcache.enable" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
  it("lets a saved but never-applied node be withdrawn while inference uses cache", () => {
    cacheDependencies.rows = [
      { spec: { kv_cache: { provider: "zcache" } }, status: undefined },
    ];
    render(
      <Form
        onSubmit={vi.fn()}
        status={{
          ...observed,
          current: { enabled: true, l1_size_gib: 8, target_nodes: ["a"] },
        }}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "a" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("checkbox", { name: "b" }).hasAttribute("disabled"),
    ).toBe(false);
  });
  it("queries dependencies only when saved or edited cache is enabled", async () => {
    render(<Form onSubmit={vi.fn()} legacy />);
    expect(cacheDependencies.query.mock.lastCall?.[0].queryOptions.enabled).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "clusters.zcache.enable" }));
    expect(cacheDependencies.query.mock.lastCall?.[0].queryOptions.enabled).toBe(true);
    expect(cacheDependencies.query.mock.lastCall?.[0].meta.select).toBe("id,spec,status");
    fireEvent.click(screen.getByRole("checkbox", { name: "clusters.zcache.enable" }));
    await waitFor(() => expect(cacheDependencies.query.mock.lastCall?.[0].queryOptions.enabled).toBe(false));
  });
  it("keeps checking dependencies while disabling a saved cache configuration", () => {
    render(<Form onSubmit={vi.fn()} status={observed} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "clusters.zcache.enable" }));
    expect(cacheDependencies.query.mock.lastCall?.[0].queryOptions.enabled).toBe(true);
  });
  it("keeps ZCache absent when an existing cluster is saved without enabling it", async () => {
    const submit = vi.fn();
    render(<Form onSubmit={submit} legacy />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const payload = transformClusterValues(submit.mock.calls[0][0], true);
    expect(payload.spec).not.toHaveProperty("zcache");
  });
  it("sends a numeric capacity and preserves the successful node when removing a failed node", async () => {
    const submit = vi.fn();
    render(<Form onSubmit={submit} status={observed} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "b" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0].spec.cache?.options).toEqual({
      enabled: true,
      l1_size_gib: 1,
      target_nodes: ["a"],
    });
  });
  it("offers undeployed candidates, not just runtime nodes", () => {
    render(<Form onSubmit={vi.fn()} status={observed} />);
    expect(screen.getByRole("checkbox", { name: "c" })).toHaveProperty(
      "disabled",
      false,
    );
  });
  it("keeps selected nodes visible during inventory failure and prevents adding stale candidates", () => {
    render(
      <Form
        onSubmit={vi.fn()}
        status={{ ...observed, observation_error: "unavailable" }}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "a" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("checkbox", { name: "c" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("alert").textContent).toContain("unavailable");
  });
  it("rejects fractional capacity and empty selection", async () => {
    const submit = vi.fn();
    render(<Form onSubmit={submit} status={observed} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "1.5" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "a" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "b" }));
    fireEvent.submit(
      screen.getByRole("button", { name: "Save" }).closest("form")!,
    );
    await waitFor(() => expect(submit).not.toHaveBeenCalled());
    expect(submit).not.toHaveBeenCalled();
  });
  it.each([
    ["0", 1],
    ["1.5", 1],
    ["2147483648", 2147483647],
    ["", 1],
  ])("normalizes %s on blur without a range message", (input, expected) => {
    render(<Form onSubmit={vi.fn()} status={observed} />);
    const capacity = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(capacity, { target: { value: input } });
    fireEvent.blur(capacity);
    expect(Number(capacity.value)).toBe(expected);
    expect(screen.queryByText("clusters.zcache.invalidCapacity")).toBeNull();
  });
  it("can disable runtime even after clearing the target selection", async () => {
    const submit = vi.fn();
    render(<Form onSubmit={submit} status={observed} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "a" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "b" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "clusters.zcache.enable" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0].spec.cache?.options.enabled).toBe(false);
  });
  it("explains bootstrap before enabling runtime on a new cluster", () => {
    render(<Form onSubmit={vi.fn()} isEdit={false} />);
    expect(screen.getByText("clusters.zcache.createHint")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

it("allows clearing capacity before entering a replacement", () => {
  render(<Form onSubmit={vi.fn()} />);
  const input = screen.getByRole("spinbutton") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "" } });
  expect(input.value).toBe("");
  fireEvent.change(input, { target: { value: "16" } });
  expect(input.value).toBe("16");
});
