# Foundation contract

Cross-kind facts shared by more than one resource kind. Kind-specific facts live in
`src/domains/<kind>/contract.md`; this file only records what they have in common.

## Masked fields (`api:"-"`)

- Go fields tagged `api:"-"` are removed from every proxy response (`filterObject` in the resource
  proxy), so the UI never holds the stored value: `ImageRegistry.spec.authconfig` (object),
  `ModelRegistry.spec.credentials` (string). Cluster and external endpoint carry the same kind of
  field and keep their own copies (see below).
- On PATCH the proxy handler (`handlePatchWithBackfill`, triggered by `writesMaskedColumn` when the
  body contains the masked column's parent) fetches the stored row and calls `mergeExcludedFields`.
  For each excluded path it overwrites the body value with the stored one when the body value is
  missing or `isEmptyValue` (nil, empty string, empty map). Recursion enters maps present in both
  body and stored row.
- UI rule: an empty untouched secret input is omitted from the edit payload; a touched-then-emptied
  one is sent as `""`. Shared helper `omitEmptyUntouched` (`foundation/lib/touched-fields.ts`), used
  by `transformImageRegistryValues` and `transformModelRegistryValues`. Not yet switched (own copies):
  `domains/cluster/lib/transform-cluster-values.ts`,
  `domains/external-endpoint/lib/clean-upstreams-for-submit.ts`.
- Known deviations of this rule (details and evidence in the kind contracts):
  1. A partially filled object overwrites the stored one: a one-key `spec.authconfig` is not empty,
     so the other credential is lost (Image Registry deviation 1).
  2. A touched-then-emptied secret is sent as `""`, which `mergeExcludedFields` treats as empty and
     backfills, so a stored secret cannot be cleared from the UI (Model Registry deviation 1).

## Edit PATCH

Refine edit forms send the whole loaded record as the PATCH body, including `id` and `status`
(proxy keeps those top-level fields). The status snapshot is therefore written back on every edit.
Whether a stale `status` (e.g. `ModelRegistryStatus.stats`) is harmful was not traced. Applies to all
kinds on the shared edit flow.

## Table batch delete

`foundation/components/Table.tsx` sets `enableRowSelection: enableBatchDelete`, a table-wide flag.
A kind that withholds per-row delete (Model Registry: `registryIsProvisioned`) still lets those rows
be selected and batch-deleted; the backend then refuses per row (`builtinModelRegistryGuard`, 10132).
See Model Registry deviation 2.

## Status tone

`foundation/components/BaseStatus` renders the chip; callers pass `className` (tone) and
`translatedPhase`. Tone classes use the `--nt-stroke|fill|text-*` tokens of `variables.css`
(positive, serious, notice, neutral). Registries share `RegistryStatus` (phases Connected, Failed,
Pending, Deleted -> `status.phases.registry.<phase>`), used by Image Registry and Model Registry.
Other kinds (cluster, external endpoint, engine, log sink, identity source, model catalog) keep a
local phase-to-class table with their own phase set; several repeat the same positive / serious /
notice / neutral strings. An absent phase renders `EmptyValue`.

## Domain code in foundation

Image repository listing (`foundation/lib/api/image-registry-content.ts`,
`foundation/hooks/use-image-repositories.ts`) is consumed only by `domains/endpoint`
(`ImageRegistryExplorerDialog`), not by `domains/image-registry`. It stays in foundation because
`.dependency-cruiser.cjs` (`no-L2-cross-domain`) forbids the endpoint domain importing it from
another domain. The same holds for `model-registry-visibility` / `model-registry-availability`.
