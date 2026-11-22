# License contract

UI source: `License`, `LicenseSpec`, `LicenseStatus` (`src/foundation/types/license.ts`),
`useLicense` (`src/foundation/license/use-license.ts`), `LicenseShow` (`src/pages/license/show.tsx`).
The page reads GET `/api/v1/license` and updates through PATCH on the same route; no RPC is called.
Backend: `origin/main@062192f6` in neutree-be contains no License Go type, table, migration, route or controller.
Permissions, validation, masking and activation semantics of a licensed server are therefore unverified.
Requirements below describe the UI, not a verified server schema.

## Type

Server ownership means received data. Only replacement code is editable; all backend rules/defaults are unverified.

| path | type | required/default in UI | owner | secret | editable here |
|---|---|---|---|---|---|
| `id` | number | required | server | unknown | no |
| `api_version`, `kind` | string, License literal | required | server | unknown | no |
| `metadata` | Metadata | required | server | unknown | no |
| `spec.code` | string | required in type; input blank | user | masking unknown | replacement only |
| `status` | LicenseStatus or null | required; nullable | server | unknown | no |
| `status.phase` | Pending, Active, Expired, Invalid | required with status | server | no UI masking | no |
| `status.last_transition_time` | timestamp string | required with status | server | no UI masking | no |
| `status.error_message` | string | optional | server | no UI masking | no |
| `status.info` | LicenseInfo | required with status | server | no UI masking | no |
| `status.info.edition`, `.vendor`, `.license_type` | strings | required | server | no UI masking | no |
| `status.info.version` | string | optional | server | no UI masking | no |
| `status.info.sign_date` | Unix seconds | required | server | no UI masking | no |
| `status.info.period` | seconds | required; unlimited sentinel -1 | server | no UI masking | no |
| `status.info.max_gpus` | number | required; unlimited sentinel -1 | server | no UI masking | no |
| `status.info.serial` | string | required | server | shown verbatim | no |
| `status.usage` | LicenseUsage | optional | server | no UI masking | no |
| `status.usage.GPU`, `.Workspace` | UsedInfo | optional entries | server | no UI masking | no |
| usage entry `used`, `limit` | numbers | required; unlimited limit -1 | server | no UI masking | no |
| usage entry `details` | string to number map | optional | server | no UI masking | no |

`ResourceType` contains only GPU and Workspace. There is no features array, entitlement map, activation flag
or explicit expiry timestamp. Expiration derives from sign date and period.
Version, usage details and metadata are hidden; the status message and transition time appear in the status tooltip.

## Roles

- Detail fields: `licenseInfoFields` and `licenseUsageFields` (`src/domains/license/lib/detail-fields.tsx`) describe
  every shown field; `DetailFields` (`foundation/scene`) lays them out and `FieldValue` (`foundation/type`) renders
  plain values. Tests: `lib/detail-fields.test.ts`. See `src/foundation/contract.md`, "Detail fields".
- Time: sign date uses `role/Timestamp` and expiration `formatTimestamp`, both with the `YYYY-MM-DD` format in the
  browser timezone (Unix seconds).
- Duration: the period floors seconds to whole days; `remainingDays` rounds positive remaining days upward and
  clamps expired values to zero. The current instant is read when rendered, without a countdown timer.
- Limits: `MAX_UNLIMITED` is -1. Permanent period hides both duration arithmetic and remaining days;
  unlimited GPU maximum and usage limits use `license.unlimited`. A limited GPU maximum is a number, formatted by
  `FieldValue` for the locale; usage is the text `used / limit`.
- Status: `LicenseStatus` (`src/domains/license/components/LicenseStatus.tsx`) renders `role/BaseStatus` with
  the tone and label key from `lib/phase.ts`: Active positive, Expired and Invalid serious, Pending notice, anything else neutral.
  Labels use `license.phase.<lowercase phase>`. The chip's tooltip shows `status.error_message` and
  `status.last_transition_time`.
- Edition and license type use lowercased translation keys; vendor is raw text. Serial is raw text with a copy
  button (`LicenseSerial`, `useCopyToClipboard`, tested in `use-copy-to-clipboard.test.ts`).

## Scenes

- Entry (`src/App.tsx`): Settings resource `license` has list URL `/license`; that route mounts `LicenseShow`.
  There is no resource-specific permission metadata or permission check on the page's update action.
- Read (`useLicense`): `useCustom<License>` GET `/license`, retry false, automatic error notification disabled.
  It expects one object under provider `data`, without parameters.
- Show (`LicenseShow`): status chip, then `DetailFields` over `status.info` (edition, vendor, license type, sign
  date, valid period, expiration, GPU maximum, serial) and, when present, over `status.usage`.
  Loading shows `license.loading`; statusCode 404 shows `license.noLicense`.
- Missing status renders no license fields. Other read errors have no explicit message here; cached status can remain.
  A nullish used count reads as zero for every usage entry. Missing entries are omitted.
- Update (`handleUpdateLicense`): a blank textarea is independent of the fetched `spec.code`; success clears it.
  Only mutation loading disables it, including after a 404 or missing status.
- Create, standalone Edit, Delete and batch actions: no UI. First activation and replacement share the update action.
  No file upload, multipart body or separate activate RPC.
- YAML: `src/foundation/contract.md`, “YAML import and export”; no License export option or dedicated import.

## Payload and reopen

`useLicense.handleUpdateLicense` rejects trimmed-empty strings, then passes the original string
as `values: {code}` to `useCustomMutation`, method patch and URL `/license`.
A replacement sends exactly `{code:"new-license-code"}`. Padded input sends `{code:"  padded-code  "}`;
multiline input sends `{code:"line-one\nline-two"}`. There is no trim, decoding or spec wrapper on the wire.
`dataProvider.custom` serializes the object and sends uppercase PATCH to the API base plus `/license`.
No other fields are sent.

Reopening initializes the textarea to an empty string even when GET includes `spec.code`.
Untouched submit sends no request and shows `license.errors.emptyCode`; typed-then-cleared input behaves the same.
Empty or whitespace-only input cannot express deactivation. Null codes have no input path.
`use-license.test.ts` pins rejection, verbatim payloads, refetch and callback/toast behavior.
`foundation/providers/data-provider/index.test.ts` pins the uppercase PATCH transport.

The textarea is plain text; fetched code is never displayed. Server masking and backfill remain untraced.

## Feature consumers

`useLicense.supportMultiWorkspace` reads only `status.usage.Workspace.limit`: above one or -1 enables it;
missing license/status/usage/entry/limit disables it. Phase, expiration, edition, used count and GPU limit are ignored.
`licenseNotAvailable` means exactly error statusCode 404; no production consumer reads that returned flag.

`src/domains/role-assignment/hooks/use-role-assignment-form.tsx:useRoleAssignmentForm` passes this boolean into
`src/domains/role-assignment/lib/scope.ts:availableScopes`. Nondelegated callers gain Workspace scope when true;
delegated callers receive department scope only. The form also retains the currently loaded scope even if unavailable.
Its initial global scope ignores asynchronous license loading, as its kept comment explains.
Tests: `scope.test.ts`, `use-role-assignment-form.test.tsx`, `foundation/license/use-license.test.ts`.

Workspace pages do not consult the flag. No other production hook consumers or field readers were found.
`cacheUpgradeErrorMessage` translates server error 21001 as license-required; it is not a license-derived gate.

## Descriptions

Labels and placeholder use `license.fields.*`, `license.update.codeLabel` and `license.update.codePlaceholder`.
No signature, length or format check is added to the nonblank rule.
Edition has an Enterprise translation; license types have Trial, Perpetual and Subscription translations.
Unknown values receive dynamically constructed keys without an explicit raw-value fallback.

## Overrides

- The shared hook and types stay in foundation because Role Assignment consumes the license capability.
  A move would add a cross-domain dependency.
- Update is a flat custom PATCH rather than the generic record edit flow; its backend reason is unverified.
  Shared edit payload mechanics: `src/foundation/contract.md`, “Edit PATCH”.

## Error mapping

Empty input uses `license.errors.emptyCode`. Mutation success uses `license.success.updated`, refetches the license
and invokes the caller's success callback; the returned PATCH record is not used to populate the page.
Mutation errors toast `error.message` or `license.errors.updateFailed`, then invoke the error callback.
Serial copy success uses `license.success.serialCopied`; copy failure reuses `license.errors.updateFailed`.
Transport error decoding: `src/foundation/contract.md`, “Error toast path”. No license-specific code or field mapping.
License error codes remain unknown.

## Known deviations

1. The license-derived Workspace scope choice is incompatible with the public backend.
   UI: `useLicense.supportMultiWorkspace`, `availableScopes` and `useRoleAssignmentForm` offer it when the limit allows.
   API: `api.enforce_global_role_assignment` (`db/migrations/131_group_role_assignments.up.sql`) rejects explicit
   nonglobal workspace scope with 10041. Users can select Workspace scope but saving fails with a toast on this backend.
   Ticket: TBD

## Open points

No live activation was exercised. Licensed GET/PATCH schemas, authorization, masking, expiry enforcement and GPU
accounting are unverified. Phase-independent gating is an observation, not a proven contradiction with the
unavailable license API.
`api.validate_workspace_limit` (`021_workspace_limits`) caps the public backend at one live workspace;
licensed overrides and whether successful PATCH means immediate activation remain untraced.
