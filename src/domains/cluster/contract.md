# Cluster contract

Backend: Go `v1.Cluster` (`api/v1/cluster_types.go`, `api/v1/cache_types.go`, `api/v1/ray_types.go`), table
`api.clusters`, served through the resource proxy `/api/v1/clusters` (`internal/routes/proxies/cluster_proxy.go`,
`RegisterClusterRoutes`: `CreateStructProxyHandler[v1.Cluster]` for GET, plus `validateClusterRequest` in front of POST and
PATCH). Reconciled by the cluster controllers (`internal/cluster`). Extra routes used by the UI:
`GET /clusters/available_versions` (`internal/routes/clusters/cluster_versions.go`, `getAvailableClusterVersions`) and RPC
`upgrade_zcache` (cache runtime upgrade). Permissions: `cluster:read|create|update|delete` (RLS in `003_resources`,
`022_soft_delete_permission`), `cluster:read-credentials`
(`037_sensitive_field_permission`; used by the credentials route, not by this UI's pages).
Refine resource `clusters`: workspaced, `idColumnName: "metadata->name"`.

## Type

UI type: `src/domains/cluster/types.ts` (`Cluster`, `ClusterSpec`, `ClusterConfig`, `ClusterStatus`).

| path | type | required | default | owner | secret | editable after create | backend rule |
|---|---|---|---|---|---|---|---|
| `metadata.name` | string | yes | `""` | user | no | no (input disabled) | generic `validate_metadata_name` 10001 / 10003 / 10004 |
| `metadata.workspace` | string | yes | current workspace if valid, else `""` | user | no | no (disabled) | `validate_metadata_workspace` |
| `metadata.creation_timestamp` | timestamp | - | - | server | no | no | - |
| `spec.type` | `ssh` / `kubernetes` | yes | `ssh` | user | no | no (select disabled) | `validate_cluster_config` (049) 10014 when blank |
| `spec.image_registry` | string (registry name) | yes | `""` | user | no | no (combobox disabled) | 10015 when blank; PATCH on an initialized cluster cannot change it (`validateInitializedClusterConfigurationUpdate`, 10209) |
| `spec.version` | string (semver) | yes | `VITE_DEFAULT_CLUSTER_VERSION`, then the newest of `available_versions` (create) | user | no | upgrade only: via the Upgrade dialog, not the edit form (combobox disabled on edit) | `validateClusterVersionInput` 10209 when blank, 10212 when not semver (`ValidateDesiredClusterVersion`); `validateClusterVersionUpdateInput` 10212 on downgrade (`ValidateClusterVersionUpgrade`) |
| `spec.config.ssh_config.provider.head_ip` | string (IP) | yes for ssh | `""` | user | no | no (disabled on edit) | 10018 when blank; 10017 when `provider` missing |
| `spec.config.ssh_config.provider.worker_ips` | string[] | no | `[]` | user | no | yes | none |
| `spec.config.ssh_config.provider.{type,coordinator_address,region,availability_zone,project_id}` | string | no | - | user | no | no UI | none; declared in UI `Provider`, no form field |
| `spec.config.ssh_config.auth.ssh_user` | string | yes for ssh | `""` | user | no | no (disabled on edit) | 10020 when blank; 10019 when `auth` missing |
| `spec.config.ssh_config.auth.ssh_private_key` | string (base64 of PEM) | no | `""` | user | yes (`api:"-"` on `Auth.SSHPrivateKey`) | yes, write-only | none at create; on an initialized cluster a non-base64 value is 10209 |
| `spec.config.kubernetes_config.kubeconfig` | string (base64 of kubeconfig) | yes for kubernetes | `""` | user | yes (`api:"-"` on `KubernetesClusterConfig.Kubeconfig`) | yes, write-only | 10021 when blank, 10030 when `kubernetes_config` missing; on an initialized cluster a new non-empty value must keep the same API server URL (10209) |
| `spec.config.kubernetes_config.router.access_mode` | `LoadBalancer` / `NodePort` (`Ingress` exists in Go, not offered) | yes for kubernetes | `LoadBalancer` on switching to kubernetes | user | no | yes | 10023, 10022 when `router` missing |
| `spec.config.kubernetes_config.router.replicas` | int >= 1 | yes for kubernetes | `2` | user | no | yes | 10024 blank, 10028 not an integer, 10027 < 1 |
| `spec.config.kubernetes_config.router.resources.cpu` | string | yes for kubernetes | `"1"` | user | no | yes | 10025 blank, 10115 unless `^[0-9]+m?$`, 10029 when `resources` missing |
| `spec.config.kubernetes_config.router.resources.memory` | string | yes for kubernetes | `"1Gi"` | user | no | yes | 10026 blank, 10114 unless `^[0-9]+([.][0-9]+)?(Ki|Mi|Gi|Ti|Pi|Ei|[kKMGTPE]i?)$` |
| `spec.config.kubernetes_config.router.{version,max_connections_per_backend,connect_timeout_seconds,sock_connect_timeout_seconds,sock_read_timeout_seconds}` | string / number | no | - | user | no | no UI | `validateClusterRouterProxyInput` (proxy options need a Router version past `RouterClientConfigVersionGate`, ranges 0-65535 and 0-604800 s). UI type declares only `version` |
| `spec.config.model_caches[]` | `{name, host_path / nfs / pvc}` | no | `[]` | user | no | see Overrides | `validate_cluster_modelcache_config` (049): array 10201, at most one 10202, name required 10203, not `default` 10204, name `^[a-z0-9]([-a-z0-9]*[a-z0-9])?$` 10205, name immutable 10206, `pvc.storageClassName` immutable 10207. Only Kubernetes supports nfs and pvc (Go comment on `ModelCache`) |
| `spec.config.metrics.accelerator_exporter.mode` | `managed` / `external` | no | - | user | no | no UI | none; absent from UI type, round-trips as an untyped key |
| `spec.config.accelerator_type` | string / null | no | - | user (Go: deprecated) | no | no UI | none |
| `spec.accelerator_virtualization.enabled` | bool | no | `false` on switching to kubernetes | user | no | yes, kubernetes only | `validateClusterAcceleratorVirtualizationCluster`: kubernetes only and version >= `MinVirtualizationClusterVersion` (`v1.1.0`), 10208; `validateClusterAcceleratorVirtualizationTransition`: enable blocked by running GPU endpoints 10231, disable blocked by vGPU endpoints 10211, mode switch 10228 |
| `spec.accelerator_virtualization.{mode,config_patch}` | `template` / `core`, object | no | - | user | no | no UI | `ValidateAcceleratorVirtualizationMode` / `...ConfigPatch` 10210. UI type declares `config_patch`, not `mode` |
| `spec.cache` | `{provider, options}` | no | absent | user | no | via the cache dialog only | `cacheProviders.Validate` -> 10208 (`providerValidationError`); provider change needs removal first |
| `spec.cache.options` (zcache) | `{version?, enabled, l1_size_gib, target_nodes[]}` | - | - | user | no | via cache dialog | provider-defined `CLUSTER_CACHE_*` codes (see Error mapping) |
| `status.phase` | `Pending` / `Initializing` / `Running` / `Updating` / `Upgrading` / `Paused` / `Failed` / `Deleting` / `Deleted` | - | - | server | no | no | controller |
| `status.{error_message,last_transition_time,image,dashboard_url,version,ray_version,initialized,ready_nodes,desired_nodes,node_provision_status,accelerator_type,component_status}` | various | - | - | server | no | no | controller. `status.version` is the minimum node version |
| `status.resource_info` | `ClusterResources` | - | - | server | no | no | `020_cluster_resource_info`; drives the resources section |
| `status.cache` | `{provider, phase, conditions, details}` | - | - | server | no | no | `ClusterCacheStatus`; `phase` in Disabled / Reconciling / Ready / Unavailable / Failed |
| `status.observed_spec_hash`, `status.accelerator_virtualization` | string / object | - | - | server | no | no | `055`, `085`; not in the UI type |

`spec.config.ssh_config.auth.ssh_private_key` and `spec.config.kubernetes_config.kubeconfig` are tagged `api:"-"`: the
proxy removes them from every response (`filterObject`), so the UI never holds a stored secret. The credentials route
returns them for `cluster:read-credentials` holders and YAML export uses it (`CREDENTIAL_RESOURCES` in
`foundation/hooks/use-yaml-export.ts`).

## Roles

- Status tone: `domains/cluster/components/ClusterStatus` over `BaseStatus`, label key `status.phases.cluster.<phase>`.
  Tones come from shared `STATUS_TONE` (`foundation/lib/status-tone.ts`): Running positive; Failed serious;
  Pending, Paused, Initializing, Updating notice; Deleted, Deleting neutral. Upgrading keeps one local class string
  (outstanding tone, no shared equivalent). Absent phase renders `EmptyValue`; the show header omits the chip when
  there is no phase.
- Secret input: `kubeconfig` and `ssh_private_key` are `<Textarea>` (not masked while typing), edit hint
  `common.messages.leaveEmptyToKeepValue`; omitted from the edit payload while empty and untouched through shared
  `omitEmptyUntouched` (`foundation/lib/touched-fields.ts`), see Foundation contract "Masked fields".
- Time: `Timestamp` (relative) for created in list and show header.
- Name / workspace / created / actions columns: `useMetadataColumns`; the show page's endpoint table reuses it.
- Empty marker: `EmptyValue` for a missing version, router access mode, replicas, cpu, memory.
- Type label: `ClusterType` maps `ssh` to `clusters.options.multipleStaticNodes`, `kubernetes` to
  `clusters.options.kubernetes`, other values shown as is.
- Access mode label: `getAccessModeLabel` (`status.accessModes.<mode>`).
- Boolean display for accelerator virtualization: list badge and show meta use `common.options.enabled|disabled`;
  `isAcceleratorVirtualizationEnabled` (`lib/accelerator-virtualization.ts`).
- Version display: `status.version` (what runs); during `Upgrading` shows `status.version -> spec.version`;
  otherwise `ClusterUpgradeTip` when a newer image exists.
- Resource quantities: `ClusterResourceSummary`, `NodeResourcesTable`, `ResourceProgressBar` (own formatting; not
  traced in this contract).

## Scenes

- List (`pages/clusters/list.tsx`): columns name (link), workspace, status, version, type, accelerator virtualization
  (badge), image registry (link to the registry), created (sortable), actions. Sorting and filters on, search on
  `metadata->>name`, `defaultSorters`, batch delete on. Row actions: edit, delete, plus `ClusterUpgradeAction`
  (dialog, see Edit).
- Show (`pages/clusters/show.tsx`): polls the record every 10 s while the monitor tab is not open. Header: name, type,
  version (with upgrade arrow or tip), image registry link, accelerator virtualization (kubernetes only), created, status
  chip. Tabs: basic (always), cache (kubernetes and `system capabilities.cluster_cache_providers` includes `zcache`),
  monitor (always), Ray dashboard (ssh). Basic tab: ssh head IP / worker IPs, or router access mode / replicas / cpu /
  memory, resource summary, node resources (table or cards, view stored in `localStorage`), model cache list, endpoints
  on this cluster. Secrets are not shown.
- Create (`pages/clusters/create.tsx` + `hooks/use-cluster-form.tsx`): sections basic information, cluster
  configuration (type, image registry, version), provider (head/worker IPs or kubeconfig), node authentication (ssh),
  router, accelerator virtualization, model caches. `mode: "all"`. Switching type replaces `spec.config` with the
  defaults of that type. Version list comes from `/clusters/available_versions` for the selected workspace, registry and
  type; the newest is auto-selected, and cleared when none. Payload: `transformClusterValues(values, false)`.
- Edit (`edit.tsx`): same form. Locked: name, workspace, type, image registry, version, head IP, ssh user, and the model
  cache fields of ssh clusters. Prefilled from the API record, which has no kubeconfig or ssh key, so those start empty
  with the "leave empty to keep" hint. Query refetch on focus/reconnect is off so a controller status write does not
  revert unsaved edits. On save `transformClusterValues(values, true, touchedFields)`; refine PATCHes the whole record
  (including `id` and `status`) with `spec.cache` normalized.
- Upgrade (`ClusterUpgradeAction`): list/show action. Loads `available_versions` (with `accelerator_type` when known),
  keeps only versions above `spec.version` (`getUpgradeVersions`), PATCHes `{...cluster, spec: {...cluster.spec, version}}`
  (the whole row, no secrets). Errors toast `getErrorMessage`.
- Cache (kubernetes + zcache; `ClusterCacheSection`, `ZCacheEditor`, `CacheRetry`, `ZCacheUpgrade`): edit dialog PATCHes
  `{spec}` where `spec` is the loaded spec with `cache` replaced and an empty `kubeconfig` dropped (and, when the cache
  phase is Failed, `metadata.annotations["neutree.ai/zcache-retry"]` = a fresh uuid). `CacheRetry` PATCHes the same
  annotation alone. `ZCacheUpgrade` posts RPC `upgrade_zcache` (`p_cluster_id`, `p_version`, `p_expected_signature`,
  `p_endpoints`).
- Delete: soft delete (PATCH `metadata.deletion_timestamp`, plus annotation `neutree.ai/force-delete` when the force
  checkbox is ticked), via the shared delete provider and `DeleteConfirmDialog`. Backend pre-check
  `validateClusterDeletion` (`validateClusterSoftDelete`): refuses with 10126 while an endpoint in the workspace has
  `spec.cluster` equal to the name; force does not bypass it. No 10126-specific UI handling.
- YAML import/export: kind `Cluster` <-> `clusters`; export is in `CREDENTIAL_RESOURCES`.
- Quick start (`foundation/hooks/use-quick-start.ts`, `buildClusterValues`): creates `quick-start-cluster`, ssh, registry
  `public-docker`, with its own copy of the ssh key encoding.

## Descriptions

- `metadata.name`: label `common.fields.name`, placeholder `clusters.placeholders.clusterName`; no UI rule.
- `metadata.workspace`: required and `isValidWorkspace` (`common.validation.workspaceRequired`).
- `spec.version`: required (`clusters.validation.versionRequired`), placeholder `clusters.placeholders.selectVersion`,
  disabled until workspace, registry and type are set and while loading.
- `spec.config.ssh_config.provider`: `NodeIPsField` + `validateNodeIps`: head IP required (`ipRequired`), valid IP
  (`invalidIPAddress`), not among worker IPs (`ipDuplicated`); worker input checked on add (`validateSingleIp`).
- `kubeconfig`, `ssh_private_key`: label only; edit hint "leave empty to keep".
- `router.*`: labels only; replicas `<Input type="number">`; no format rule for cpu / memory (the API checks them).
- `spec.accelerator_virtualization.enabled`: checkbox, description `clusters.descriptions.acceleratorVirtualization`,
  or `...UnsupportedVersion` and disabled when `isAcceleratorVirtualizationSupported(version)` is false (version above
  `v1.0.1`). An `useEffect` unticks it when the version stops supporting it.
- Model caches: at most one (`canAdd`); `nfs.server` required and IP-valid, paths required and start with `/`, pvc
  storage required and `isValidStorageQuantity`; name has no UI rule; pvc defaults `accessModes: ["ReadWriteMany"]`,
  storage `500Gi`; ssh clusters offer host path only.

## Overrides

- Secrets omitted on edit when empty and untouched (`transformClusterValues`, shared `omitEmptyUntouched`). Reason: the
  API never returns them (see Type); commit "keep unsaved cluster edits from being reverted by query refetch (NEU-500)"
  governs the touched tracking. The two touched checks also gate base64 encoding: an edit value is encoded only when
  touched, create always encodes.
- Base64 encoding in the UI (ssh key gets a trailing `\n` first, kubeconfig as is): the API stores and decodes base64
  (`validateInitializedClusterConfigurationUpdate`, `util.GetKubeConfigFromCluster`). Reason from the code: the controller
  reads them base64.
- Router `replicas` converted with `Number` only when truthy; an empty string stays `""`.
- `spec.accelerator_virtualization` dropped from the payload unless kubernetes and `isAcceleratorVirtualizationSupported`.
  An untouched kubernetes edit at a supported version still sends `accelerator_virtualization: {}` (the checkbox field
  registers the path), where the stored row has none.
- `spec.cache` normalized in the payload (`transformClusterValues`): kept only for zcache on kubernetes with a boolean
  `enabled`, otherwise removed; `l1_size_gib` coerced with `Number`, `version` kept only when set.
- Refetch on focus/reconnect disabled for the edit query (`useClusterForm`): status is rewritten every few seconds.
- Version combobox on edit includes the current version even when `available_versions` lacks it (the API lists upgrade
  targets only).
- Model cache fields disabled on edit for ssh clusters only: reason unknown (introduced with the cluster form fix
  #115). The API's own immutability rules (10206, 10207) are not mirrored for kubernetes clusters, see Known deviations.
- `ZCacheEditor` drops an empty `kubeconfig` itself (own copy of the rule, no touched tracking: the dialog has no secret
  input).
- Not shared with the other statuses: `Upgrading` tone; list "accelerator virtualization" badge uses the positive and
  neutral tone strings without the `border` prefix (Badge supplies it).

## Error mapping

No field mapping for the cluster form. Create/edit/delete failures go through the data provider `handleError`
(`message: hint`) and the Refine notification provider as an error toast. Exceptions:

- `useClusterForm` `errorNotification`: `clusterCacheErrorMessage` (`lib/zcache-errors.ts`) maps provider codes
  `CLUSTER_CACHE_INVALID_OPTIONS`, `..._INVALID_TARGET_NODE(S)`, `..._UNSUPPORTED_RUNTIME`, `..._USE_UPGRADE_ACTION`,
  `..._VERSION_REQUIRED`, `..._INVALID_SPEC`, `..._IN_USE` to `clusters.zcache.errors.*` under the title
  `clusters.zcache.saveFailed`; unmapped errors fall through to the default toast.
- `cacheUpgradeErrorMessage` maps `21001` and `CACHE_UPGRADE_*` to `clusters.cacheUpgrade.errors.*`.
- Cache and upgrade dialogs show the message inline (`getErrorMessage`, `cacheMessage`), the upgrade dialog toasts.
- Codes the form can hit without a mapping: 10001/10003/10004 (name), 10014-10030 and 10114/10115 (required and router
  fields), 10201-10207 (model cache), 10208-10212, 10228, 10231 (virtualization, version, configuration update), 10126
  (delete), 10331 (PATCH that writes `spec` must match one row, `ambiguousBackfillCode`). With the form as built,
  10015 (image registry), 10020 (ssh user) and 10021 (kubeconfig on create) are reachable because the form has no
  required rule for those fields; head IP is guarded by `validateNodeIps`, type always has a value.

## Known deviations

1. Accelerator virtualization version gate is looser than the API's.
   - UI: `isAcceleratorVirtualizationSupported` (`lib/accelerator-virtualization.ts`,
     `MAX_UNSUPPORTED_ACCELERATOR_VIRTUALIZATION_CLUSTER_VERSION = "v1.0.1"`) treats every version above `v1.0.1`
     as supported, so v1.0.2 enables the checkbox; the description text says "v1.1.0 or later". Pinned by
     `transform-cluster-values.test.ts` ("v1.0.2 ... kept: true").
   - API: `ValidateAcceleratorVirtualizationClusterSupport` -> `SupportsVirtualizationClusterVersion`
     (`internal/cluster/version/hami.go`) requires base version >= `MinVirtualizationClusterVersion` (`v1.1.0`) and
     answers 10208 otherwise.
   - Effect: on a cluster version between v1.0.2 and v1.0.x the user can tick the box and gets a 10208 toast at save.
     Ticket: TBD
2. Kubernetes model cache name and PVC storage class stay editable on edit.
   - UI: `ModelCacheFields` is disabled only for `isEdit && isSSH` (`isModelCacheDisabled` in `useClusterForm`).
   - API: `validate_cluster_modelcache_config` (049) rejects a changed `model_caches[0].name` (10206) and a changed
     `pvc.storageClassName` (10207) on UPDATE.
   - Effect: editing either field looks accepted and fails at save with a generic toast. Ticket: TBD
3. A touched-then-emptied secret cannot clear the stored value.
   - UI: `omitEmptyUntouched` keeps a touched empty `kubeconfig` / `ssh_private_key` and sends `""`
     (pinned by `use-cluster-form.test.tsx`).
   - API: `mergeExcludedFields` (`resource_proxy.go`) treats `""` as `isEmptyValue` and backfills the stored value.
   - Effect: the save succeeds and the secret is unchanged; for a kubernetes cluster clearing is invalid anyway
     (10021), so the visible cost is the silent no-op. Same mechanism as Foundation "Masked fields" item 2. Ticket: TBD
4. A kubeconfig or ssh key with characters outside Latin-1 cannot be saved.
   - UI: `transformClusterValues` calls `btoa` on the raw text, which throws for such characters
     (pinned by `transform-cluster-values.test.ts`); the submit fails with no field error.
   - API: the secrets are plain base64 of the file bytes (`util.GetKubeConfigFromCluster`, `base64.StdEncoding` in
     `validateInitializedClusterConfigurationUpdate`); UTF-8 content is valid.
   - Effect: a kubeconfig with a non-ASCII comment or cluster name fails to submit. Ticket: TBD

## Notes not classed as deviations

- Edit echoes `id` and `status` back in the PATCH (the proxy keeps those top-level fields,
  `extractTopLevelJSONFields`). Cluster status is rewritten by the controller every few seconds, so each edit and each
  upgrade writes a possibly stale status snapshot. Whether that is harmful was not traced (Foundation "Edit PATCH").
- Reopen round trip, traced: an untouched edit sends `spec.config.ssh_config.auth` without `ssh_private_key` (ssh) or
  `spec.config.kubernetes_config` without `kubeconfig` (kubernetes). `handlePatchWithBackfill` runs because the body
  holds the masked column `spec`; `mergeExcludedFields` recurses into `spec.config.ssh_config.auth` /
  `kubernetes_config` (maps present in body and stored row) and copies the missing excluded key from the stored row.
  `validateClusterRequest` builds `New` with the same function (`buildPostgrestClusterPatchValidationNew`), so
  `validate_cluster_config` sees the stored secret (10021 does not fire). Keys the form has no field for
  (`spec.config.metrics`, router proxy options, `accelerator_virtualization.mode`) round-trip because refine sends the
  whole loaded record; pinned by `use-cluster-form.test.tsx`.
- Whitespace-only values: the form does not trim; the API rejects blank `head_ip`, `ssh_user`, `image_registry` (10018,
  10020, 10015) after `trim`.
