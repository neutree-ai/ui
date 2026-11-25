# Cluster contract

Backend: `v1.Cluster` (`api/v1/cluster_types.go`, `cache_types.go`, `ray_types.go`), table `api.clusters`, proxy
`/api/v1/clusters` (`RegisterClusterRoutes`: GET; POST/PATCH through `validateClusterRequest`). Extra: `GET
/clusters/available_versions` (`getAvailableClusterVersions`), RPC `upgrade_zcache`. Permissions:
`cluster:read|create|update|delete`, `cluster:read-credentials` (`037`; credentials route, YAML export). Refine:
workspaced `clusters`, key metadata->name. Shared mechanics: `src/foundation/contract.md`.

## Type

UI type: `src/domains/cluster/types.ts`. Owner is user unless noted; "edit" = editable after create.

| path | type | required / default | secret | edit | backend rule |
|---|---|---|---|---|---|
| `metadata.name`, `.workspace` | string | yes; workspace defaults to current if valid | no | no | `validate_metadata_name` 10001/10003/10004; `validate_metadata_workspace` |
| `spec.type` | `ssh` / `kubernetes` | yes; `ssh` | no | no | `validate_cluster_config` (049) 10014 blank |
| `spec.image_registry` | registry name | yes; `""` | no | no | 10015 blank; initialized cluster cannot change it (`validateInitializedClusterConfigurationUpdate`, 10209) |
| `spec.version` | semver | yes; `VITE_DEFAULT_CLUSTER_VERSION`, else newest `available_versions` | no | upgrade dialog only | `validateClusterVersionInput` 10209 blank, 10212 not semver; `validateClusterVersionUpdateInput` 10212 downgrade |
| `spec.config.ssh_config.provider.head_ip` | IP | ssh; `""` | no | no | 10018 blank; 10017 `provider` missing |
| `...provider.worker_ips` | string[] | no; `[]` | no | yes | none |
| `...provider.{type,coordinator_address,region,availability_zone,project_id}` | string | no | no | no UI | none; in UI `Provider`, no form field |
| `...ssh_config.auth.ssh_user` | string | ssh; `""` | no | no | 10020 blank; 10019 `auth` missing |
| `...ssh_config.auth.ssh_private_key` | base64 PEM | no; `""` | yes (`api:"-"`) | write-only | none on create; initialized cluster: non-base64 is 10209 |
| `...kubernetes_config.kubeconfig` | base64 kubeconfig | kubernetes; `""` | yes (`api:"-"`) | write-only | 10021 blank, 10030 `kubernetes_config` missing; initialized: new value must keep the API server URL (10209) |
| `...router.access_mode` | `LoadBalancer` / `NodePort` (`Ingress` in Go, not offered) | kubernetes; `LoadBalancer` | no | yes | 10023; 10022 `router` missing |
| `...router.replicas` | int >= 1 | kubernetes; `2` | no | yes | 10024 blank, 10028 not integer, 10027 < 1 |
| `...router.resources.cpu` | string | kubernetes; `"1"` | no | yes | 10025 blank, 10115 unless `^[0-9]+m?$`, 10029 `resources` missing |
| `...router.resources.memory` | string | kubernetes; `"1Gi"` | no | yes | 10026 blank, 10114 unless Kubernetes quantity (`^[0-9]+([.][0-9]+)?(Ki\|Mi\|Gi\|Ti\|Pi\|Ei\|[kKMGTPE]i?)$`) |
| `...router.{version,max_connections_per_backend,*_timeout_seconds}` | string / number | no | no | no UI | `validateClusterRouterProxyInput` (proxy options need Router version past `RouterClientConfigVersionGate`; 0-65535, 0-604800 s); UI type has only `version` |
| `spec.config.model_caches[]` | `{name, host_path / nfs / pvc}` | no; `[]` | no | see Overrides | `validate_cluster_modelcache_config` (049): array 10201, at most one 10202, name required 10203, not `default` 10204, name `^[a-z0-9]([-a-z0-9]*[a-z0-9])?$` 10205, name immutable 10206, `pvc.storageClassName` immutable 10207; nfs/pvc kubernetes only (Go comment) |
| `spec.config.metrics.accelerator_exporter.mode` | `managed` / `external` | no | no | no UI | none; not in UI type, round-trips untyped |
| `spec.config.accelerator_type` | string / null | no (Go: deprecated) | no | no UI | none |
| `spec.accelerator_virtualization.enabled` | bool | no; `false` on switching to kubernetes | no | kubernetes only | `validateClusterAcceleratorVirtualizationCluster`: kubernetes and version >= `MinVirtualizationClusterVersion` (`v1.1.0`) 10208; `...Transition`: enable blocked by running GPU endpoints 10231, disable by vGPU endpoints 10211, mode switch 10228 |
| `...accelerator_virtualization.{mode,config_patch}` | `template` / `core`, object | no | no | no UI | `ValidateAcceleratorVirtualizationMode` / `...ConfigPatch` 10210; UI type has `config_patch` only |
| `spec.cache` | `{provider, options}` | no; absent | no | cache dialog only | `cacheProviders.Validate` -> 10208 (`providerValidationError`); provider change needs removal first |
| `spec.cache.options` (zcache) | `{version?, enabled, l1_size_gib, target_nodes[]}` | - | no | cache dialog | provider `CLUSTER_CACHE_*` codes (Error mapping) |
| `status.phase` | Pending / Initializing / Running / Updating / Upgrading / Paused / Failed / Deleting / Deleted | server | no | no | controller |
| `status.{error_message,last_transition_time,image,dashboard_url,version,ray_version,initialized,ready_nodes,desired_nodes,node_provision_status,accelerator_type,component_status}` | various | server | no | no | controller; `status.version` is the minimum node version |
| `status.resource_info` | `ClusterResources` | server | no | no | `020_cluster_resource_info` |
| `status.cache` | `{provider, phase, conditions, details}` | server | no | no | `ClusterCacheStatus`; phase Disabled / Reconciling / Ready / Unavailable / Failed |
| `status.observed_spec_hash`, `.accelerator_virtualization` | string / object | server | no | no | `055`, `085`; not in UI type |

Masking and credential export: `src/foundation/contract.md`, “Masked fields”, “YAML import and export”.

## Roles

- Status: `lib/phases.ts` `clusterPhases` (Foundation "Status tone"), label `status.phases.cluster.<phase>`; Running
  positive, Failed serious, Pending / Paused / Initializing / Updating notice, Upgrading outstanding, Deleting / Deleted
  neutral.
- Secret input: `omitEmptyUntouched` (`foundation/role/touched-fields.ts`), edit hint
  `common.messages.leaveEmptyToKeepValue`.
- Columns `useMetadataColumns`; time `Timestamp`; empty marker `EmptyValue`; type label `ClusterType` (other values as
  is); `getAccessModeLabel`; `isAcceleratorVirtualizationEnabled` (`lib/accelerator-virtualization.ts`).
- Device observations and placement: `src/foundation/contract.md`, “Accelerator resources”.
- Version: `status.version` (what runs); `Upgrading` shows `status.version -> spec.version`; else `ClusterUpgradeTip`.
  Resources: `ClusterResourceSummary`, `NodeResourcesTable`.

## Scenes

- List: search `metadata->>name`, `defaultSorters`, batch delete; row actions edit, delete, `ClusterUpgradeAction`.
- Show: header (`clusterHeaderFields`: type, version, image registry link, accelerator virtualization on kubernetes
  only), SSH nodes, router and each model cache are `DetailFields` over `lib/detail-fields.tsx` (`clusterSshFields`,
  `clusterRouterFields`, `modelCacheFields`; Foundation "Detail fields"): worker IPs comma-joined, an unknown access
  mode (`getAccessModeLabel`) or absent router capacity as the empty marker, a cache's type as plain text and its
  path from `nfs` or else `host_path`. Polls every 10 s unless the monitor tab is open. Cache tab needs kubernetes and `system
  capabilities.cluster_cache_providers` containing `zcache`. Secrets not shown.
- Create (`use-cluster-form.tsx`): `mode: "all"`; payload `transformClusterValues(values, false)`. Switching type
  replaces `spec.config` with that type's defaults. Versions come from `/clusters/available_versions` for workspace,
  registry and type; the newest is selected, cleared when none.
- Edit: locked name, workspace, type, image registry, version, head IP, ssh user, model cache fields of ssh clusters.
  Secrets start empty. Focus/reconnect refetch is off to avoid overwriting edits with controller updates. Save
  `transformClusterValues(values, true, touchedFields)`; whole record PATCH with `spec.cache` normalized.
- Upgrade (`ClusterUpgradeAction`): `available_versions` (with `accelerator_type` when known), only versions above
  `spec.version` (`getUpgradeVersions`); PATCH `{...cluster, spec: {...cluster.spec, version}}`; error toasts
  `getErrorMessage`.
- Cache (`ClusterCacheSection`, `ZCacheEditor`, `CacheRetry`, `ZCacheUpgrade`): dialog PATCH `{spec}` (loaded spec,
  `cache` replaced, empty `kubeconfig` dropped; when cache phase is Failed also
  `metadata.annotations["neutree.ai/zcache-retry"]` = fresh uuid). `CacheRetry` PATCHes that annotation alone.
  `ZCacheUpgrade` posts RPC `upgrade_zcache` (`p_cluster_id`, `p_version`, `p_expected_signature`, `p_endpoints`).
- Delete: Foundation "Soft delete and force". Pre-check `validateClusterDeletion` (`validateClusterSoftDelete`): 10126
  while an endpoint in the workspace has `spec.cluster` equal to the name.
- YAML: kind `Cluster` <-> `clusters`, credential-capable. Quick start (`domains/dashboard/hooks/use-quick-start.ts`,
  `buildClusterValues`): `quick-start-cluster`, ssh, registry `public-docker`, own copy of the ssh key encoding.

## Descriptions

- `metadata.workspace`: required, `isValidWorkspace`; `metadata.name`: no UI rule. `spec.version`: required
  (`clusters.validation.versionRequired`), disabled until workspace, registry and type are set.
- ssh provider `validateNodeIps`: head IP required (`ipRequired`), valid (`invalidIPAddress`), not among workers
  (`ipDuplicated`); workers checked on add (`validateSingleIp`). `router.*`: no cpu / memory format rule (API checks).
- `accelerator_virtualization.enabled`: disabled unless `isAcceleratorVirtualizationSupported(version)` (above
  `v1.0.1`), and unticked when the version stops supporting it.
- Model caches: at most one; `nfs.server` required and IP-valid, paths start with `/`, pvc storage
  `isValidStorageQuantity`; pvc defaults `accessModes: ["ReadWriteMany"]`, `500Gi`; ssh offers host path only; name no
  UI rule.

## Overrides

- Secrets omitted on edit when empty and untouched; the touched checks also gate base64 encoding (edit encodes only
  touched values, create always).
- Base64 in the UI (ssh key gets a trailing `\n`, kubeconfig as is): the controller reads them base64
  (`validateInitializedClusterConfigurationUpdate`, `util.GetKubeConfigFromCluster`).
- Router `replicas` converted with `Number` only when truthy; empty string stays `""`.
- `spec.accelerator_virtualization` dropped unless kubernetes and supported version. An untouched kubernetes edit at a
  supported version still sends `accelerator_virtualization: {}` (the checkbox registers the path); the stored row has
  none.
- `spec.cache` normalized: kept only for zcache on kubernetes with boolean `enabled`, else removed; `l1_size_gib` via
  `Number`, `version` only when set. `ZCacheEditor` drops an empty `kubeconfig` itself (no touched tracking, no secret
  input).
- Version combobox on edit includes the current version though `available_versions` lists upgrade targets only.
- Model cache fields disabled on edit for ssh only: reason unknown (cluster form fix #115); the API's 10206 / 10207 are
  not mirrored for kubernetes (deviation 2).
- Cache dependents (`lib/cache-endpoints.ts:cacheEndpointRefs`, shared by `ClusterCacheSection` and `ZCacheFields`):
  only endpoints whose `status.kv_cache` reports zcache with `details.in_use === true`; an endpoint that only
  declares the provider in spec does not count. These block disabling the cache and removing applied target nodes.
  Reason: matches the backend admission check (code comment); paused or unscheduled endpoints have no running Pods.
  The backend side is not on neutree-be `origin/main@062192f6`, so it is untraced here.

## Error mapping

No field mapping; Foundation "Error toast path". Exceptions:

- `useClusterForm` `errorNotification`: `clusterCacheErrorMessage` (`lib/zcache-errors.ts`) maps
  `CLUSTER_CACHE_INVALID_OPTIONS`, `..._INVALID_TARGET_NODE(S)`, `..._UNSUPPORTED_RUNTIME`, `..._USE_UPGRADE_ACTION`,
  `..._VERSION_REQUIRED`, `..._INVALID_SPEC`, `..._IN_USE` to `clusters.zcache.errors.*` under
  `clusters.zcache.saveFailed`; others fall through.
- `cacheUpgradeErrorMessage`: `21001` and `CACHE_UPGRADE_*` to `clusters.cacheUpgrade.errors.*`. Cache and upgrade
  dialogs show the message inline (`getErrorMessage`, `cacheMessage`).
- Unmapped codes the form can hit: 10001/10003/10004, 10014-10030, 10114/10115, 10201-10207, 10208-10212, 10228, 10231,
  10126 (delete), 10331. Reachable because the form has no required rule: 10015, 10020, 10021 (create); head IP is
  guarded by `validateNodeIps`, type always has a value.

## Known deviations

1. Accelerator virtualization version gate is looser than the API's.
   - UI: `isAcceleratorVirtualizationSupported` (`lib/accelerator-virtualization.ts`,
     `MAX_UNSUPPORTED_ACCELERATOR_VIRTUALIZATION_CLUSTER_VERSION = "v1.0.1"`) accepts every version above `v1.0.1`; the
     description says "v1.1.0 or later". Pinned by `transform-cluster-values.test.ts` ("v1.0.2 ... kept: true").
   - API: `ValidateAcceleratorVirtualizationClusterSupport` -> `SupportsVirtualizationClusterVersion`
     (`internal/cluster/version/hami.go`) requires >= `MinVirtualizationClusterVersion` (`v1.1.0`), else 10208.
   - Effect: on v1.0.2-v1.0.x the box can be ticked and save fails with a 10208 toast. Ticket: TBD
2. Kubernetes model cache name and PVC storage class stay editable on edit.
   - UI: `ModelCacheFields` disabled only for `isEdit && isSSH` (`isModelCacheDisabled` in `useClusterForm`).
   - API: `validate_cluster_modelcache_config` (049) rejects a changed `model_caches[0].name` (10206) and
     `pvc.storageClassName` (10207) on UPDATE.
   - Effect: the edit looks accepted and fails at save with a generic toast. Ticket: TBD
3. A touched-then-emptied secret cannot clear the stored value.
   - UI: `omitEmptyUntouched` keeps a touched empty `kubeconfig` / `ssh_private_key` and sends `""` (pinned by
     `use-cluster-form.test.tsx`).
   - API: `mergeExcludedFields` (`resource_proxy.go`) treats `""` as `isEmptyValue` and backfills the stored value.
   - Effect: saving succeeds but leaves the secret unchanged; an empty kubeconfig is invalid (10021). Same mechanism as
   Foundation "Masked fields" item 2. Ticket: TBD
4. A kubeconfig or ssh key with characters outside Latin-1 cannot be saved.
   - UI: `transformClusterValues` calls `btoa` on the raw text, which throws (pinned by
     `transform-cluster-values.test.ts`); submit fails with no field error.
   - API: plain base64 of the file bytes (`util.GetKubeConfigFromCluster`, `base64.StdEncoding` in
     `validateInitializedClusterConfigurationUpdate`); UTF-8 content is valid.
   - Effect: a kubeconfig with a non-ASCII comment or name fails to submit. Ticket: TBD

## Notes not classed as deviations

- Edit and upgrade echo `id` and a possibly stale `status` (Foundation "Edit PATCH"; the controller rewrites status
  every few seconds); harm not traced.
- Reopen round trip, traced: an untouched edit sends `ssh_config.auth` without `ssh_private_key` (ssh) or
  `kubernetes_config` without `kubeconfig` (kubernetes); `mergeExcludedFields` recurses into those maps and restores the
  key, and `validateClusterRequest` sees it (10021 does not fire). Keys with no form field (`spec.config.metrics`,
  router proxy options, `accelerator_virtualization.mode`) round-trip because refine sends the whole record. Pinned by
  `use-cluster-form.test.tsx`.
- Whitespace-only values: the form does not trim; the API rejects blank `head_ip`, `ssh_user`, `image_registry` (10018,
  10020, 10015) after `trim`.
