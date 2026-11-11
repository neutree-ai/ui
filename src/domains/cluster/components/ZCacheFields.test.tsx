import type { UseFormReturnType } from "@refinedev/react-hook-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cluster, ClusterCacheStatus, ZCacheStatus } from "../types";
import { ZCacheFields } from "./ZCacheFields";

const cacheDependencies = vi.hoisted(() => ({
  query: vi.fn(),
  rows: [] as Array<{
    id: number;
    metadata?: { name?: string; display_name?: string; workspace?: string };
    spec: { kv_cache?: { provider: string } | null };
    status?: { kv_cache?: { provider: string; details: { in_use: boolean } } };
  }>,
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
vi.mock("@/foundation/components/Link", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
beforeEach(() => {
  cacheDependencies.rows = [];
  cacheDependencies.query.mockClear();
});

function Form({
  onSubmit,
  status,
  isEdit = true,
  legacy = false,
  summaryPhase,
}: {
  onSubmit: (data: Cluster) => void;
  status?: ZCacheStatus;
  isEdit?: boolean;
  legacy?: boolean;
  summaryPhase?: ClusterCacheStatus["phase"];
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
        <ZCacheFields
          form={adapted}
          isEdit={isEdit}
          status={status}
          summary={
            summaryPhase
              ? { provider: "zcache", phase: summaryPhase, conditions: [] }
              : undefined
          }
        />
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
      reason: "cache runtime unavailable",
    },
  ],
};

describe("ZCacheFields", () => {
  it.each([
    ["Ready", "clusters.zcache.applied"],
    ["Reconciling", "clusters.zcache.reconciling"],
    ["Failed", "clusters.zcache.failed"],
    ["Unavailable", "clusters.zcache.unavailable"],
    ["Disabled", "clusters.zcache.disabled"],
  ] as const)("labels a %s cache summary", (phase, label) => {
    render(<Form onSubmit={vi.fn()} summaryPhase={phase} />);
    screen.getByText(label);
  });

  it("blocks removal while endpoints still use cache, but allows expansion", () => {
    cacheDependencies.rows = [
      {
        id: 1,
        metadata: { name: "endpoint-a" },
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
        .getByRole("switch", { name: "clusters.zcache.enable" })
        .hasAttribute("disabled"),
    ).toBe(true);
    screen.getAllByText("clusters.zcache.dependencyCount:1");
    screen.getAllByText("endpoint-a");
    screen.getAllByText("clusters.zcache.dependencyInstruction");
    screen.getByText("cache runtime unavailable");
  });
  it("links each dependent endpoint to its detail route by resource name", () => {
    cacheDependencies.rows = [
      {
        id: 7,
        metadata: {
          name: "endpoint-resource",
          display_name: "Endpoint display name",
          workspace: "team-a",
        },
        spec: { kv_cache: { provider: "zcache" } },
      },
    ];
    render(<Form onSubmit={vi.fn()} status={observed} />);
    const links = screen.getAllByRole("link", {
      name: "Endpoint display name",
    });
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/team-a/endpoints/show/endpoint-resource",
      "/team-a/endpoints/show/endpoint-resource",
    ]);
  });
  it("lets a saved but never-applied node be withdrawn while inference uses cache", () => {
    cacheDependencies.rows = [
      {
        id: 1,
        metadata: { name: "endpoint-a" },
        spec: { kv_cache: { provider: "zcache" } },
        status: undefined,
      },
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
    expect(
      cacheDependencies.query.mock.lastCall?.[0].queryOptions.enabled,
    ).toBe(false);
    fireEvent.click(
      screen.getByRole("switch", { name: "clusters.zcache.enable" }),
    );
    await waitFor(() =>
      expect(
        cacheDependencies.query.mock.lastCall?.[0].queryOptions.enabled,
      ).toBe(true),
    );
    expect(cacheDependencies.query.mock.lastCall?.[0].meta.select).toBe(
      "id,metadata,spec,status",
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "clusters.zcache.enable" }),
    );
    await waitFor(() =>
      expect(
        cacheDependencies.query.mock.lastCall?.[0].queryOptions.enabled,
      ).toBe(false),
    );
  });
  it("keeps checking dependencies while disabling a saved cache configuration", () => {
    render(<Form onSubmit={vi.fn()} status={observed} />);
    fireEvent.click(
      screen.getByRole("switch", { name: "clusters.zcache.enable" }),
    );
    expect(
      cacheDependencies.query.mock.lastCall?.[0].queryOptions.enabled,
    ).toBe(true);
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
  it("adds an undeployed candidate, not just runtime nodes", async () => {
    const submit = vi.fn();
    render(<Form onSubmit={submit} status={observed} />);
    expect(screen.getByRole("checkbox", { name: "c" })).toHaveProperty(
      "disabled",
      false,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "c" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0].spec.cache?.options.target_nodes).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
  it("filters the cache node table", () => {
    render(<Form onSubmit={vi.fn()} status={observed} />);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "clusters.zcache.searchNodes" }),
      { target: { value: "c" } },
    );
    expect(screen.queryByRole("checkbox", { name: "a" })).toBeNull();
    screen.getByRole("checkbox", { name: "c" });
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
    await screen.findByText("clusters.zcache.selectNodes");
    expect(submit).not.toHaveBeenCalled();
  });
  it.each(["0", "1.5", "2147483648", ""])(
    "keeps invalid capacity %s visible with an explanation",
    async (input) => {
      render(<Form onSubmit={vi.fn()} status={observed} />);
      const capacity = screen.getByRole("spinbutton") as HTMLInputElement;
      fireEvent.change(capacity, { target: { value: input } });
      fireEvent.blur(capacity);
      expect(capacity.value).toBe(input);
      await screen.findByText("clusters.zcache.invalidCapacity");
    },
  );
  it("can disable runtime even after clearing the target selection", async () => {
    const submit = vi.fn();
    render(<Form onSubmit={submit} status={observed} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "a" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "b" }));
    fireEvent.click(
      screen.getByRole("switch", { name: "clusters.zcache.enable" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0].spec.cache?.options.enabled).toBe(false);
  });
  it("explains bootstrap before enabling runtime on a new cluster", () => {
    render(<Form onSubmit={vi.fn()} isEdit={false} />);
    screen.getByText("clusters.zcache.createHint");
    expect(screen.queryByRole("switch")).toBeNull();
  });
  it("allows clearing capacity before entering a replacement", () => {
    render(<Form onSubmit={vi.fn()} />);
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "16" } });
    expect(input.value).toBe("16");
  });
});
