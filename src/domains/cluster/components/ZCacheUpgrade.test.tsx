import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Cluster } from "../types";
import { ZCacheUpgrade } from "./ZCacheUpgrade";

const { mutate, invalidate } = vi.hoisted(() => ({
  mutate: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string) => s }),
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
vi.mock("@refinedev/core", () => ({
  useCan: () => ({ data: { can: true } }),
  useInvalidate: () => invalidate,
  useCustomMutation: () => ({ mutateAsync: mutate, isLoading: false }),
  useList: ({ resource }: { resource: string }) => ({
    data: {
      data:
        resource === "engines"
          ? [
              {
                id: 1,
                metadata: { name: "vllm" },
                spec: { versions: [{ version: "v0.31.0" }] },
              },
            ]
          : [
              {
                id: 1,
                metadata: {
                  name: "upgrade",
                  annotations: { "neutree.ai/resource-spec-signature": "old1" },
                },
                spec: {
                  engine: { engine: "vllm", version: "v0.24.0" },
                  kv_cache: { provider: "zcache" },
                },
              },
              {
                id: 2,
                metadata: {
                  name: "disable",
                  annotations: { "neutree.ai/resource-spec-signature": "old2" },
                },
                spec: {
                  engine: { engine: "vllm", version: "v0.24.0" },
                  kv_cache: { provider: "zcache" },
                  replicas: { num: 0 },
                },
              },
              {
                id: 3,
                metadata: { name: "unrelated" },
                spec: { engine: { engine: "vllm", version: "v0.24.0" } },
              },
            ],
    },
  }),
}));
const cluster = {
  id: 7,
  metadata: {
    name: "cluster",
    workspace: "default",
    annotations: { "neutree.ai/resource-spec-signature": "before" },
  },
  spec: { cache: { provider: "zcache", options: { enabled: true } } },
  status: {
    cache: { provider: "zcache", details: { ready_runtime_version: "v0.5.0" } },
  },
} as unknown as Cluster;
beforeEach(() => {
  mutate.mockReset();
  invalidate.mockReset();
});
it("requires choices for every incompatible instance and submits one atomic plan", async () => {
  render(<ZCacheUpgrade cluster={cluster} />);
  fireEvent.click(screen.getByText("clusters.cacheUpgrade.title"));
  fireEvent.change(screen.getAllByRole("combobox")[0], {
    target: { value: "v0.5.5" },
  });
  expect(screen.queryByText("unrelated")).toBeNull();
  expect(
    screen.getByText("clusters.cacheUpgrade.confirm").closest("button")
      ?.disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("upgrade"), {
    target: { value: "v0.31.0" },
  });
  fireEvent.change(screen.getByLabelText("disable"), {
    target: { value: "disable" },
  });
  fireEvent.click(screen.getByText("clusters.cacheUpgrade.confirm"));
  await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
  expect(mutate.mock.calls[0][0].values).toEqual({
    p_cluster_id: 7,
    p_version: "v0.5.5",
    p_expected_signature: "before",
    p_endpoints: [
      {
        name: "upgrade",
        expected_signature: "old1",
        engine_version: "v0.31.0",
        disable_cache: false,
      },
      {
        name: "disable",
        expected_signature: "old2",
        engine_version: "",
        disable_cache: true,
      },
    ],
  });
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
});
