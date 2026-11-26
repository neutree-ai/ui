import type { TFunction } from "i18next";
import ClusterType from "@/domains/cluster/components/ClusterType";
import { ClusterVersion } from "@/domains/cluster/components/ClusterVersion";
import { isAcceleratorVirtualizationEnabled } from "@/domains/cluster/lib/accelerator-virtualization";
import { isKubernetesCluster } from "@/domains/cluster/lib/cluster-type";
import { getAccessModeLabel } from "@/domains/cluster/lib/get-access-mode-label";
import { getCacheType } from "@/domains/cluster/lib/get-cache-type";
import type { Cluster, ModelCache } from "@/domains/cluster/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";
import { ShowButton } from "@/foundation/scene/ShowButton";

type Config = Cluster["spec"]["config"];
type SshConfig = NonNullable<Config["ssh_config"]>;
type KubernetesConfig = NonNullable<Config["kubernetes_config"]>;

const acceleratorVirtualization: DetailField<Cluster> = field(
  "clusters.fields.acceleratorVirtualization",
  (cluster, t) =>
    t(
      isAcceleratorVirtualizationEnabled(cluster)
        ? "common.options.enabled"
        : "common.options.disabled",
    ),
);

/** The header fields; accelerator virtualization applies to Kubernetes only. */
export const clusterHeaderFields = (
  cluster: Cluster,
): DetailField<Cluster>[] => [
  field("common.fields.type", {
    render: (current) => <ClusterType type={current.spec.type} />,
  }),
  field("common.fields.version", {
    render: (current) => <ClusterVersion cluster={current} />,
  }),
  field("common.fields.imageRegistry", {
    render: (current) => (
      <ShowButton
        recordItemId={current.spec.image_registry}
        meta={{ workspace: current.metadata.workspace }}
        variant="link"
        resource="image_registries"
      >
        {current.spec.image_registry}
      </ShowButton>
    ),
  }),
  ...(isKubernetesCluster(cluster) ? [acceleratorVirtualization] : []),
];

export const clusterSshFields: DetailField<SshConfig>[] = [
  field("clusters.fields.headIp", (ssh) => ssh.provider.head_ip),
  field("clusters.fields.workerIps", (ssh) => ssh.provider.worker_ips),
];

export const clusterRouterFields: DetailField<KubernetesConfig>[] = [
  field("clusters.fields.accessMode", (k8s, t) =>
    getAccessModeLabel(k8s.router?.access_mode, t),
  ),
  field("clusters.fields.replicas", (k8s) => k8s.router?.replicas),
  field("common.fields.cpu", (k8s) => k8s.router?.resources?.cpu),
  field("common.fields.memory", (k8s) => k8s.router?.resources?.memory),
];

const CACHE_TYPE_KEYS = {
  nfs: "clusters.options.nfs",
  pvc: "clusters.options.pvc",
  host_path: "clusters.options.hostPath",
} as const;

const CACHE_TITLE_KEYS = {
  nfs: "clusters.fields.modelCache.type.nfs",
  pvc: "clusters.fields.modelCache.type.pvc",
  host_path: "clusters.fields.modelCache.type.host_path",
} as const;

/** A model cache's heading: its name, else its storage kind. */
export const modelCacheTitle = (cache: ModelCache, t: TFunction) =>
  cache.name || t(CACHE_TITLE_KEYS[getCacheType(cache)]);

type CacheField = DetailField<ModelCache>;

const cacheName: CacheField = field(
  "common.fields.name",
  (cache) => cache.name,
);
const nfsServer: CacheField = field(
  "clusters.fields.modelCache.nfsServer",
  (cache) => cache.nfs?.server,
);
const cachePath: CacheField = field(
  "clusters.fields.modelCache.cachePath",
  (cache) => cache.nfs?.path ?? cache.host_path?.path,
);
const storage: CacheField = field(
  "clusters.fields.modelCache.storage",
  (cache) => cache.pvc?.resources?.requests?.storage,
);
const storageClass: CacheField = field(
  "clusters.fields.modelCache.storageClassName",
  (cache) => cache.pvc?.storageClassName,
);

/** The settings of one model cache, by where it stores the models. */
export const modelCacheFields = (cache: ModelCache): CacheField[] => [
  ...(cache.name ? [cacheName] : []),
  field("clusters.fields.modelCache.cacheType", (current, t) =>
    t(CACHE_TYPE_KEYS[getCacheType(current)]),
  ),
  ...(cache.nfs ? [nfsServer] : []),
  ...(cache.nfs || cache.host_path ? [cachePath] : []),
  ...(cache.pvc ? [storage] : []),
  ...(cache.pvc?.storageClassName ? [storageClass] : []),
];
