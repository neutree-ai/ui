import type {
  Cluster,
  ClusterStatus,
  ModelCache,
} from "@/domains/cluster/types";
import {
  fixtureMetadata,
  VISUAL_WORKSPACE,
} from "@/foundation/testing/visual-fixtures";

function makeCluster(
  name: string,
  spec: Pick<Cluster["spec"], "type" | "config">,
  status: Cluster["status"],
): Cluster {
  return {
    id: 1,
    api_version: "v1",
    kind: "Cluster",
    metadata: fixtureMetadata(name, { workspace: VISUAL_WORKSPACE }),
    spec: { image_registry: "registry-a", version: "v1.0.0", ...spec },
    status,
  };
}

// The phase and access mode enums are not exported; fixtures name them by value.
const phase = (value: string) => value as NonNullable<ClusterStatus["phase"]>;

const runningStatus: NonNullable<Cluster["status"]> = {
  phase: phase("Running"),
  last_transition_time: "2026-05-30T10:00:00Z",
  image: "registry.example.com/neutree/serve:v1.0.0",
  dashboard_url: null,
  ready_nodes: 3,
  desired_nodes: 3,
  initialized: true,
};

const modelCaches: ModelCache[] = [
  {
    name: "shared-models",
    nfs: { server: "10.0.0.20", path: "/exports/models" },
  },
  {
    name: "local-models",
    host_path: { path: "/data/models", type: "Directory" },
  },
  {
    name: "claimed",
    pvc: {
      storageClassName: "fast-ssd",
      resources: { requests: { storage: "500Gi" } },
    },
  },
];

/** An SSH cluster with a head and two workers and every kind of model cache. */
export const sshCluster = makeCluster(
  "cluster-a",
  {
    type: "ssh",
    config: {
      ssh_config: {
        provider: {
          type: "static",
          head_ip: "10.0.0.10",
          worker_ips: ["10.0.0.11", "10.0.0.12"],
        },
        auth: { ssh_user: "ubuntu" },
      },
      model_caches: modelCaches,
    },
  },
  runningStatus,
);

/** An SSH cluster with no head address and no workers, and a failed status. */
export const emptySshCluster = makeCluster(
  "cluster-b",
  {
    type: "ssh",
    config: {
      ssh_config: {
        provider: { type: "static", head_ip: "", worker_ips: [] },
        auth: { ssh_user: "ubuntu" },
      },
    },
  },
  {
    ...runningStatus,
    phase: phase("Failed"),
    error_message: "head node is unreachable",
    ready_nodes: 0,
    desired_nodes: 1,
  },
);

/** A Kubernetes cluster with a configured router and one NFS model cache. */
export const kubernetesCluster = makeCluster(
  "cluster-c",
  {
    type: "kubernetes",
    config: {
      kubernetes_config: {
        router: {
          access_mode: "LoadBalancer" as NonNullable<
            NonNullable<
              NonNullable<
                Cluster["spec"]["config"]["kubernetes_config"]
              >["router"]
            >["access_mode"]
          >,
          replicas: 2,
          resources: { cpu: "2", memory: "4Gi" },
        },
      },
      model_caches: modelCaches.slice(0, 1),
    },
  },
  runningStatus,
);

/** A Kubernetes cluster that leaves the router unconfigured. */
export const bareKubernetesCluster = makeCluster(
  "cluster-d",
  { type: "kubernetes", config: { kubernetes_config: {} } },
  runningStatus,
);

/** An SSH cluster moving to v1.1.0 before any node reports a version. */
const upgrading = makeCluster("cluster-e", sshCluster.spec, {
  ...runningStatus,
  phase: phase("Upgrading"),
});
export const upgradingCluster: Cluster = {
  ...upgrading,
  spec: { ...upgrading.spec, version: "v1.1.0" },
};

/** A running GPU cluster on v1.0.0 whose accelerator has no newer version. */
export const gpuCluster = makeCluster("cluster-f", sshCluster.spec, {
  ...runningStatus,
  version: "v1.0.0",
  accelerator_type: "nvidia_gpu",
});

const versionsPath = (cluster: Cluster, acceleratorType?: string) =>
  `clusters/available_versions?${new URLSearchParams({
    workspace: VISUAL_WORKSPACE,
    image_registry: cluster.spec.image_registry,
    cluster_type: cluster.spec.type,
    ...(acceleratorType ? { accelerator_type: acceleratorType } : {}),
  }).toString()}`;

/**
 * `available_versions` for SSH clusters on registry-a: v1.1.0 in general, but
 * only v1.0.0 for the nvidia_gpu accelerator.
 */
export const clusterVersions = {
  [versionsPath(sshCluster)]: { available_versions: ["v1.0.0", "v1.1.0"] },
  [versionsPath(sshCluster, "nvidia_gpu")]: {
    available_versions: ["v1.0.0"],
  },
};
