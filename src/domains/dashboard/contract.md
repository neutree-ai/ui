# Dashboard contract

Backend: `v1.Cluster`, `v1.Endpoint`, `api.clusters`, `api.endpoints` (`003_resources`);
`RegisterClusterRoutes`, `RegisterEndpointRoutes`. GET `/api/v1/system/info`: `SystemInfo` / `handleSystemInfo`
(`internal/routes/system/system.go`). No Dashboard RPC.
Backend: `origin/main@062192f6`. Counts need `cluster:read` / `endpoint:read`; quick start needs read/create for
four kinds and `engine:read` (`003_resources` policies).
UI: `src/pages/dashboard/`; wizard: `src/foundation/hooks/use-quick-start.ts:useQuickStart`.

## Type

Aggregates are server-owned/read-only; inputs are user-owned. Wizard progress is local, not a resource phase.

| path or value | type | required/default | secret | editable here | source or backend rule |
|---|---|---|---|---|---|
| count `data[0].count` | number | expected aggregate row | no | no | `Counter`; count projection |
| `SystemInfo.grafana_url` | string | optional | no | no | `validateAndCleanURL`; HTTP or HTTPS prefix |
| `QuickStartInput.headIp` | string | required; blank | no | input phase | `Provider.HeadIP`; Cluster contract |
| `QuickStartInput.sshUser` | string | required; blank | no | input phase | `Auth.SSHUser`; Cluster contract |
| `QuickStartInput.sshPrivateKey` | text | required; blank | yes | input phase | `Auth.SSHPrivateKey`; base64 bytes |
| step `status` | pending, in-progress, success, skipped, error | pending | no | operation-owned | no backend field |

## Roles

- Counts are raw numbers. Loading shows a skeleton; missing cluster data stays blank, endpoint data becomes zero.
- `ResourceResultList` shows Created/Skipped/errors; progress counts success and skipped equally. No lifecycle tone.
- Grafana owns units/missing data. Embed: `getOverviewDashboardProps` / `buildGrafanaDashboardUrl`;
  tests: `src/foundation/lib/grafana-dashboard-configs.test.ts`, `grafana-dashboard-url.test.ts`.

## Aggregate sources

`Dashboard` calls `useList<Counter>` for clusters/endpoints with `meta.select:"count()"`; shows `data[0].count`.
No explicit filters, sorters, pagination or polling; `dataProvider.getList` uses exact count/default range.
Counts include readable deleting rows across workspaces; no phase filter.
Workspace query mechanics: `src/foundation/contract.md`, “Workspace selection”.

`useSystemApi`: GET `/system/info`, five-minute stale time, three retries. `handleSystemInfo` omits
unconfigured/invalid Grafana URL. Embed: `neutree-overview-embed`, datasource `neutree-cluster`, organization 1,
all clusters (`GRAFANA_VAR_ALL`), no Workspace variable; last hour, 30s refresh, browser timezone.
Sources: `panels[].targets` in backend `observability/grafana/dashboards/neutree_overview_embed_dashboard.json`.
All filter `neutree_cluster` by the Cluster regex; choices use `label_values(neutree_node_ready, neutree_cluster)`.

| aggregate | source query | display role |
|---|---|---|
| Nodes | count of distinct node labels in `neutree_node_ready` | numeric stat |
| GPU | sum of `neutree_node_accelerator_total` | numeric stat |
| GPU avg | average `neutree_accelerator_utilization_ratio` | percent fraction stat |
| GPU memory | summed accelerator used bytes divided by total bytes, minimum denominator 1 | percent fraction stat |
| Current QPS | summed vLLM success rate plus SGLang request rate or latency-count rate | requests per second stat |
| Avg latency | combined vLLM/SGLang latency-sum rates divided by latency-count rates | seconds stat |
| CPU avg | one minus average idle rate of `neutree_node_cpu_seconds_total` | percent fraction stat |
| Memory avg | summed node used bytes divided by total bytes, minimum denominator 1 | percent fraction stat |
| GPU inventory by model | accelerator total/free sums grouped by product | Model, Total and Free table |
| Cluster utilization | CPU, memory, GPU and GPU-memory queries above | four percent fraction series |

Rates use Grafana's rate interval. QPS reads `vllm:request_success_total`; SGLang prefers
`sglang:num_requests_total` over `sglang:e2e_request_latency_seconds_count`. Missing families contribute zero.
Latency uses `vllm:e2e_request_latency_seconds_sum` and `sglang:e2e_request_latency_seconds_sum`, with matching
count rates; missing family sums/counts become zero and the combined denominator is clamped to 1e-9.
Memory uses `neutree_node_memory_used_bytes` / `neutree_node_memory_total_bytes`; GPU memory uses
`neutree_accelerator_memory_used_bytes` / `neutree_accelerator_memory_total_bytes`.
Inventory also reads `neutree_node_accelerator_free`; the table merges instant queries by product.
No status breakdown or token usage.

## Scenes

- Overview (`Dashboard`): two count cards; loaded zero endpoints replaces that count with quick start.
  Missing Grafana URL shows `common.messages.grafanaNotConfigured`, including loading/errors.
  Embed variable/time controls stay enabled.
- Quick start checks/creates four resources sequentially. Existing names skip without spec/status comparison.
  Lookup errors mean absence; first create failure stops, without rollback. Retry restarts all checks.
- Success means accepted writes/existing rows, not readiness; the success message warns provisioning takes minutes.
  Close is blocked while creating; reopen keeps inputs/results because the mounted dialog never calls reset.
- Reload starts blank. No list, Show, edit, delete or YAML scene.

## Quick-start payload differences

Resource rules: `src/domains/image-registry/contract.md`, `src/domains/model-registry/contract.md`,
`src/domains/cluster/contract.md`. Wizard differences follow.
Every POST sends `api_version:"v1"`, the kind, metadata name/workspace and `labels:{}`.
Blank/`_all_` workspace uses `default`; otherwise current workspace. No Workspace creation.

- `buildImageRegistryValues`: name `public-docker`; spec is `{url:"https://docker.io",repository:"",
  authconfig:{username:"",password:"",auth:""},ca:""}`.
- `buildModelRegistryValues`: name `public-hugging-face`; spec is
  `{type:"hugging-face",url:"https://huggingface.co",credentials:""}`.
- `buildClusterValues`: name `quick-start-cluster`; type ssh, image registry `public-docker`, version
  `VITE_DEFAULT_CLUSTER_VERSION` or `v1.0.0`. Config has only ssh provider head IP, empty worker IPs and auth.
  No available-version query or ordinary Cluster submit transform.
- `buildEndpointValues`: name `quick-start-inference`; cluster `quick-start-cluster`; model registry
  `public-hugging-face`, name `afrideva/Tinystories-gpt-0.1-3m-GGUF`, file `*8_0.gguf`, version `main`, task
  `text-generation`; engine `llama-cpp`; resources `{cpu:"1",memory:"1"}`, replicas `{num:1}`,
  deployment options `{scheduler:{type:"consistent_hash"}}`, variables `{engine_args:{}}`.

Endpoint schema: `v1.EndpointSpec` (`api/v1/endpoint_types.go`); no Endpoint contract yet.
`useSelect<EngineRef>` reads workspace engines;
first llama-cpp version wins without sorting, else `v0.3.7`. Loading disables Deploy.

## Descriptions

`QuickStartDialog.validate` requires trimmed-nonblank inputs; head IP uses IPv4-only `isValidIPAddress`.
Errors: `quick_start.validation.required` / `.invalidIp`; no key-format check.
`handleDeploy` trims IP/username, preserves key text; plain key textarea. Labels: `quick_start.fields.*`.

## Overrides

Fixed payloads implement the dialog's one-node llama.cpp setup; version fallback reasons are unknown.
The hook stays in foundation; moving it removes no code.

## Secret write trace

Masking mechanics: `src/foundation/contract.md`, “Masked fields”. `ImageRegistrySpec.AuthConfig`,
`ModelRegistrySpec.Credentials`, `v1.Auth.SSHPrivateKey` (`api/v1/ray_types.go`) have exclusion tags.
`CreateStructProxyHandler` / `proxyWithMaskedResponse` mask ignored POST representations.
Existing rows, including empty/partial secrets, cause no PATCH. No credentials fetch, untouched-edit payload
or backfill dependency; reopen retains local input/results.

Registry POST secrets are exactly the empty values above. Cluster appends a newline if absent, then calls `btoa`.
With username root, input `key` or `key\n` sends
`config.ssh_config.auth:{ssh_user:"root",ssh_private_key:"a2V5Cg=="}`.
Changed input affects only an absent cluster.
Blank/whitespace input is blocked; no null input. `raySSHLocalConfigGenerator.Generate`
(`internal/cluster/ray_ssh_config.go`) decodes standard base64 to file bytes.

## Error mapping

Transport toasts: `src/foundation/contract.md`, “Error toast path”. No server-code/field mapping.
`useQuickStart.execute` shows `String(error.message)` or `Unknown error` per failed step, including encoding errors.
Endpoint validation: 10232 invalid engine (`endpointEngineError`),
10233 absent engine/version (`endpointDeployTargetNotFoundError`, `internal/routes/proxies/endpoint_validation.go`).

## Known deviations

1. A missing engine still permits deployment with a fabricated version.
   UI: `src/foundation/hooks/use-quick-start.ts:useQuickStart` falls back to v0.3.7 after missing/empty engine data.
   API: `validateEndpointEngineExists` rejects an absent engine or unpublished version with 10233.
   Users can create three resources and then fail at the Endpoint step. Ticket: TBD
2. Private-key text outside Latin-1 cannot be submitted.
   UI: `src/foundation/hooks/use-quick-start.ts:buildClusterValues` calls `btoa` without byte encoding.
   API: `raySSHLocalConfigGenerator.Generate` decodes arbitrary file bytes without a Latin-1 restriction.
   Users pasting a Unicode key comment get a Cluster-step error before its POST. Ticket: TBD

## Open points

No live API/Grafana/provisioning test; deployed datasource/auth scope is unverified.
`buildImageRegistryValues` sends obsolete ca; `ImageRegistrySpec` omits it and
`041_remove_image_registry_ca.up.sql` drops it. Acceptance is unverified; Image Registry deviation 2.
Tests: `src/foundation/hooks/use-quick-start.test.ts`: sequence, retry, workspace, key encoding, engine fallback.
Fixed payloads are not fully pinned. No submit/transform moved.
