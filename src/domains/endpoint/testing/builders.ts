import type { EndpointResourceRequestContext } from "@/domains/endpoint/lib/gpu-usability";
import type { EndpointReviewContext } from "@/domains/endpoint/lib/review-context";
import type { Endpoint } from "@/domains/endpoint/types";
import type { Metadata } from "@/foundation/types/basic-types";

/**
 * A `chat` endpoint in `default` serving `hf/qwen` with vLLM on `cluster-a`:
 * one replica of 4 CPU, 8 GiB and 1 GPU with no accelerator type, no cache
 * and nothing optional set.
 * `overrides` replace whole `metadata` or `spec` fields.
 */
export const makeEndpoint = (
  overrides: {
    metadata?: Partial<Metadata>;
    spec?: Partial<Endpoint["spec"]>;
  } = {},
): Endpoint => ({
  id: 1,
  api_version: "v1",
  kind: "Endpoint",
  metadata: {
    name: "chat",
    workspace: "default",
    deletion_timestamp: null,
    creation_timestamp: "2026-01-01T00:00:00Z",
    update_timestamp: "2026-01-01T00:00:00Z",
    labels: {},
    annotations: {},
    ...overrides.metadata,
  },
  spec: {
    cluster: "cluster-a",
    model: {
      registry: "hf",
      name: "qwen",
      version: "",
      file: "",
      task: "text-generation",
    },
    engine: { engine: "vllm", version: "0.31.0" },
    resources: { cpu: 4, memory: 8, gpu: 1, accelerator: null },
    replicas: { num: 1 },
    kv_cache: null,
    deployment_options: null,
    variables: null,
    env: null,
    ...overrides.spec,
  },
  status: null,
});

/** Review context with nothing known: no catalog, risk or capacity. */
export const makeReviewContext = (
  overrides: Partial<EndpointReviewContext> = {},
): EndpointReviewContext => ({
  catalogOrigin: null,
  modelDelivery: null,
  noVerifiedAccelerator: false,
  requiredVramGb: null,
  nodeCount: null,
  clusterCapacity: null,
  clusterCapacityUnavailable: false,
  ...overrides,
});

/**
 * A replica request for 1 CPU and 1 GiB of memory in `allocationMode`, with
 * every capacity figure zeroed. `overrides` set the fields a test is about.
 */
export const makeResourceRequest = (
  allocationMode: EndpointResourceRequestContext["allocationMode"],
  overrides: Partial<EndpointResourceRequestContext> = {},
): EndpointResourceRequestContext => ({
  allocationMode,
  cpuPerReplica: 1,
  memoryPerReplica: 1,
  requestedFullGpuCards: 0,
  fullGpuCardCapacity: 0,
  fullGpuCapacityExceeded: false,
  requestedVirtualCards: 0,
  totalVirtualCardCapacity: 0,
  requestedVgpuMemoryMiB: 0,
  availableVgpuMemoryMiB: 0,
  requestedVgpuCoreUnits: 0,
  availableVgpuCoreUnits: 0,
  vgpuCapacityExceeded: false,
  ...overrides,
});
