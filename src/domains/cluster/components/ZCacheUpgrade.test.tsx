import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { pickOption } from "@/foundation/testing/interactions";
import type { Cluster, ZCacheStatus } from "../types";
import { ZCacheUpgrade } from "./ZCacheUpgrade";

const { mutate, invalidate } = vi.hoisted(() => ({
  mutate: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("@/foundation/hooks/use-cache-versions", () => ({
  useCacheVersions: () => ({
    data: {
      data: [
        { version: "v0.5.0", engine_versions: ["v0.24.0"] },
        { version: "v0.5.5", engine_versions: ["v0.31.0"] },
      ],
    },
  }),
}));

function makeEndpoint(
  id: number,
  name: string,
  { cache = true, paused = false } = {},
) {
  return {
    id,
    metadata: {
      name,
      annotations: { "neutree.ai/resource-spec-signature": `sig-${name}` },
    },
    spec: {
      engine: { engine: "vllm", version: "v0.24.0" },
      kv_cache: cache ? { provider: "zcache" } : undefined,
      replicas: paused ? { num: 0 } : undefined,
    },
  };
}

vi.mock("@refinedev/core", () => ({
  useCan: () => ({ data: { can: true } }),
  useRouterType: () => "new",
  useRouterContext: () => ({}),
  useLink:
    () =>
    ({ to, ...props }: { to: string } & Record<string, unknown>) => (
      <a href={to} {...props} />
    ),
  useInvalidate: () => invalidate,
  useCustomMutation: () => ({ mutateAsync: mutate, isLoading: false }),
  useList: ({ resource }: { resource: string }) => ({
    data: {
      data:
        resource === "engines"
          ? [{ id: 1, spec: { versions: [{ version: "v0.31.0" }] } }]
          : [
              makeEndpoint(1, "upgrade"),
              makeEndpoint(2, "disable", { paused: true }),
              makeEndpoint(3, "unrelated", { cache: false }),
            ],
    },
  }),
}));

function makeCluster({
  upgrade,
  requestedId,
}: {
  upgrade?: ZCacheStatus["upgrade"];
  requestedId?: string;
} = {}) {
  return {
    id: 7,
    metadata: {
      name: "cluster",
      workspace: "default",
      annotations: {
        "neutree.ai/resource-spec-signature": "before",
        ...(requestedId && {
          "neutree.ai/cache-upgrade": JSON.stringify({ id: requestedId }),
        }),
      },
    },
    spec: { cache: { provider: "zcache", options: { enabled: true } } },
    status: {
      cache: {
        provider: "zcache",
        details: { ready_runtime_version: "v0.5.0", upgrade },
      },
    },
  } as unknown as Cluster;
}

const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name });

beforeEach(() => {
  mutate.mockReset();
  invalidate.mockReset();
});

it("requires a choice for every incompatible instance and submits one plan", async () => {
  render(<ZCacheUpgrade cluster={makeCluster()} />);
  fireEvent.click(button("clusters.cacheUpgrade.title"));
  expect(screen.queryByText("unrelated")).toBeNull();
  expect(button("clusters.cacheUpgrade.confirm").disabled).toBe(true);

  pickOption(
    screen.getByRole("combobox", { name: "upgrade" }),
    /^clusters\.cacheUpgrade\.engine/,
  );
  pickOption(
    screen.getByRole("combobox", { name: "disable" }),
    "clusters.cacheUpgrade.disable",
  );
  fireEvent.click(button("clusters.cacheUpgrade.confirm"));

  await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
  expect(mutate.mock.calls[0][0].values).toEqual({
    p_cluster_id: 7,
    p_version: "v0.5.5",
    p_expected_signature: "before",
    p_endpoints: [
      {
        name: "upgrade",
        expected_signature: "sig-upgrade",
        engine_version: "v0.31.0",
        disable_cache: false,
      },
      {
        name: "disable",
        expected_signature: "sig-disable",
        engine_version: "",
        disable_cache: true,
      },
    ],
  });
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
});

it("blocks a new upgrade while a request awaits reconciliation", () => {
  render(
    <ZCacheUpgrade
      cluster={makeCluster({
        requestedId: "new",
        upgrade: { id: "old", phase: "Succeeded", endpoints: [] },
      })}
    />,
  );
  screen.getByText("clusters.cacheUpgrade.phases.UpdatingRuntime");
  expect(button("clusters.cacheUpgrade.title").disabled).toBe(true);
});

it("hides the details of a successful upgrade", () => {
  render(
    <ZCacheUpgrade
      cluster={makeCluster({
        upgrade: {
          id: "done",
          phase: "Succeeded",
          endpoints: [{ name: "ep", phase: "Succeeded" }],
        },
      })}
    />,
  );
  expect(screen.queryByRole("status")).toBeNull();
});

it("links each failed instance with its failure", () => {
  render(
    <ZCacheUpgrade
      cluster={makeCluster({
        upgrade: {
          id: "done",
          phase: "Failed",
          endpoints: [
            { name: "ep", phase: "Failed", message: "image pull failed" },
          ],
        },
      })}
    />,
  );
  expect(screen.getByRole("link", { name: "ep" }).getAttribute("href")).toBe(
    "/default/endpoints/show/ep",
  );
  screen.getByText("image pull failed");
});

it("renders localized upgrade error messages for coded and permission failures", async () => {
  mutate.mockRejectedValueOnce({
    code: "CACHE_UPGRADE_IN_PROGRESS",
    message: "cache upgrade is already in progress",
  });
  render(<ZCacheUpgrade cluster={makeCluster()} />);
  fireEvent.click(button("clusters.cacheUpgrade.title"));
  pickOption(
    screen.getByRole("combobox", { name: "upgrade" }),
    /^clusters\.cacheUpgrade\.engine/,
  );
  pickOption(
    screen.getByRole("combobox", { name: "disable" }),
    "clusters.cacheUpgrade.disable",
  );
  fireEvent.click(button("clusters.cacheUpgrade.confirm"));
  await screen.findByText("clusters.cacheUpgrade.errors.alreadyInProgress:");

  mutate.mockRejectedValueOnce({
    code: "42501",
    message: "permission denied to upgrade cluster cache",
  });
  fireEvent.click(button("clusters.cacheUpgrade.confirm"));
  await screen.findByText("clusters.cacheUpgrade.errors.permissionDenied");
});
