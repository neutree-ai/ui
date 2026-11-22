import { getAccessModeLabel } from "@/domains/cluster/lib/get-access-mode-label";
import { getCacheType } from "@/domains/cluster/lib/get-cache-type";
import type { Cluster, ModelCache } from "@/domains/cluster/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";

type Config = Cluster["spec"]["config"];
type SshConfig = NonNullable<Config["ssh_config"]>;
type KubernetesConfig = NonNullable<Config["kubernetes_config"]>;

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
