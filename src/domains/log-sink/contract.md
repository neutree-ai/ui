# Log Sink contract

Backend: `v1.LogSink` (`api/v1/log_sink_types.go`), table `api.log_sinks` (composite types from `115_log_sinks`, `s3`
added by `117_log_sink_s3`; `validate_log_sink_spec` last redefined by `135_log_sink_s3_bucket_name`), proxy
`/api/v1/log_sinks` (`RegisterLogSinkRoutes`: GET, POST, PATCH; no DELETE route). Extra: `POST
/log_sinks/test_connection` (`handleLogSinkTestConnection`). Reconciled by `controllers/log_sink_controller.go` (Vector
config from `internal/observability/logsink`). No RPCs. Global resource: `validate_log_sink_spec` clears
`metadata.workspace`, so the UI has no workspace field or column. Permissions `log_sink:read|create|update|delete` (RLS
in `115`, enum in `114`), `log_sink:read-credentials` (credentials API `/credentials/log_sinks`, not called by the UI).
Refine resource `log_sinks`, `idColumnName: "metadata->name"`. Shared mechanics: `src/foundation/contract.md`.

## Type

UI type `src/domains/log-sink/types.ts`; form type `LogSinkFormValues` (`lib/log-sink-form.ts`), converted by
`toLogSinkFormValues` / `toLogSinkSpec`. Owner is user unless noted; "edit" = editable after create.

| path | type | required / default | secret | edit | backend rule |
|---|---|---|---|---|---|
| `metadata.name` | string | yes; `""` | no | no | `validate_metadata_name` 10001, 10003 (`^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$`), 10004 (> 63); unique index `log_sinks_name_unique_idx` (duplicate -> PostgREST 409) |
| `metadata.workspace` | - | server | no | - | cleared by `validate_log_sink_spec` |
| `spec.type` | `victorialogs` / `s3` | yes; `victorialogs` | no | no | 10243; a PATCH may change it, the trigger keeps only the chosen type's settings |
| `spec.enabled` | bool | no; form `true` | no | yes (switch; list/show action) | `coalesce(enabled, true)`; Go `IsEnabled` reads nil as true |
| `spec.victorialogs.url` | string | victorialogs; `""` | no | yes | 10244 blank, 10245 not `^https?://`; controller `validateVictoriaLogs`: http(s) with host, no query or fragment |
| `...victorialogs.ca_cert` | PEM | no; absent | no | yes | none at write; controller rejects a value with no valid PEM |
| `...victorialogs.insecure_skip_verify` | bool | no; absent (false) | no | yes | none |
| `...victorialogs.timeout_seconds` | int | no; absent (backend default) | no | yes | controller: not negative |
| `...victorialogs.auth.type` | `none` / `basic` / `bearer` | no; absent | no | yes | 10246 |
| `...auth.username` | string | basic; absent | no | yes | 10247 |
| `...auth.password` | string | no; absent | yes (`api:"-"` `LogSinkAuth.Password`) | write-only | none; kept by PATCH backfill |
| `...auth.token` | string | bearer; absent | yes (`api:"-"` `LogSinkAuth.Token`) | write-only | 10248, checked after the backfill (a stored token satisfies it) |
| `...victorialogs.extra_fields` | `Record<string,string>` | no; absent | no | yes | controller: key non-empty without `,` `=`, value without `,` |
| `spec.s3.endpoint` | string | no; absent (AWS endpoint of region) | no | yes | 10308 when non-empty and not `^https?://`; controller: http(s) with host, no credentials, query or fragment |
| `...s3.region` | string | yes; `""` | no | yes | 10307 |
| `...s3.bucket` | string | yes; `""` | no | yes | 10306 blank; 10327 (`135`) on INSERT or when bucket / endpoint changed: no whitespace, control chars or `/`, <= 63, AWS naming `^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$` without endpoint |
| `...s3.key_prefix` | string | no; absent (`traces/%Y/%m/%d/`, `GetKeyPrefix`) | no | yes | none at write; controller: no `{{ }}` |
| `...s3.force_path_style` | bool | no; absent (true, `UsePathStyle`) | no | yes | 10305 if not bool/null |
| `...s3.compression` | `gzip` / `zstd` / `none` | no; absent (gzip) | no | yes | 10309 |
| `...s3.flush_interval_seconds` | int | no; absent (300, `GetFlushIntervalSeconds`) | no | yes | 10310: integer 1..86400 |
| `...s3.auth.access_key_id`, `.secret_access_key` | string | yes; absent | yes (`api:"-"` `S3SinkAuth.*`) | write-only | 10311 (after backfill) |
| `spec.buffer.max_size` | int bytes | no; absent (1 GiB, `GetMaxSize`) | no | yes | 10249: number >= 268435488 |
| `status.phase` | Pending / Running / Degraded / Failed / Disabled / Deleted | server | no | no | controller |
| `status.{error_message,last_transition_time,last_sent_time}` | string / timestamp | server | no | no | controller |
| `status.{sent_events,dropped_events}` | int64 | server; omitted when 0 | no | no | controller |
| `status.last_connection_test` | `{time, ok, message}` | server | no | no | controller, not the test route |
| `status.{observed_hash,component_id}` | string | server | no | no | not in UI type |

Masked: the four secrets above (`filterObject`; an S3 `auth` therefore reads as `{}`, inferred from the filter). No
array carries a `mergekey`; `extra_fields` is a map without masked values.

## Roles

- Status: `LogSinkStatus` over `BaseStatus` / `STATUS_TONE` (Foundation "Status tone"; Disabled and Deleted neutral;
  pinned by `LogSinkStatus.test.tsx`), label `status.phases.logSink.<phase>`.
- Columns `useMetadataColumns().name`, no workspace column; time `Timestamp` (last sent, last connection test),
  `MetadataTimestampMeta` (show header).
- Local formatters (not shared roles): `formatEventCount` (`en-US` grouping, absent = 0, the API omits zero counters);
  `bytesToGib` / `gibToBytes` (GiB in the form, bytes on the wire; show `log_sinks.values.bufferGib`, absent
  `bufferDefault`); `isLogSinkEnabled` (only explicit `false` is off); `formatLogSinkDestination`; `toAuthType`
  (anything but basic/bearer is none).
- Secret input: `<Input type="password" autoComplete="new-password">`, hint `common.messages.leaveEmptyToKeepValue`;
  blank means keep (own mechanism, Overrides).

## Scenes

- List: default sorter `metadata->name` asc, search `metadata->>name`, no batch delete; row actions edit, enable /
  disable (`LogSinkEnableAction`), delete. The AI traces button polls every 15 s via `summarizeForwarding` (enabled
  count; Failed beats Degraded as the alert).
- Show: destination section by type, delivery section (counters, last sent, last connection test message), "test
  connection" for the stored sink (`{id}`), actions edit, enable / disable, delete. Secrets never shown.
- Create (`use-log-sink-form.tsx`): starts victorialogs, enabled, s3 path style on, compression gzip. Payload
  `toLogSinkPayload(values, "create")`: `{api_version, kind, metadata:{name: trimmed}, spec}`.
- Edit: locked name, type. Prefilled via `select` -> `toLogSinkFormValues` (blank secrets, buffer in GiB, extra fields
  as rows, `cacheTime: 0`). Save sends only `{spec}` (`toLogSinkPayload(values, "edit")`; PATCH replaces the `spec`
  column whole, so every kept value is sent). Only the chosen type's settings go out. Defaults the API fills are left
  out when equal to the default (`force_path_style` true, `compression` gzip, blank ca_cert, 0 timeout / flush, blank
  buffer); blank-key extra rows dropped; `enabled` always sent (absent stored value is written back as `true`).
  - Secrets, traced through `handlePatchWithBackfill` -> `mergeExcludedFields` (missing key or `""` is empty) and
    `validate_log_sink_spec`: a blank secret is omitted and backfilled; for an omitted `auth` object the proxy creates
    `auth` with only the stored secrets and the trigger, seeing no `type`, removes it ("auth removed" branch, so `none`
    works); for S3 a missing `auth` is rebuilt from both stored keys, a lone typed key keeps the other stored one.
    Stored secrets of an unused type are stripped by the trigger. Secrets can be replaced but never cleared in place
    (workaround: switch auth type to none and back). UI rules follow: bearer token required unless the stored auth type
    is bearer (`tokenRequired`), S3 keys required on create only.
- Enable / disable: PATCH `{spec: {...record.spec, enabled: !enabled}}`, pessimistic; the spec comes from a read, so
  secrets are absent and backfilled.
- Test connection (`useLogSinkTestConnection`, `buildTestConnectionRequest`): create `{spec}`, edit `{id, spec}` (the
  spec the submit would save; blank secrets filled by `backfillLogSinkSecrets` / `backfillS3Keys` only when type and
  VictoriaLogs auth type are unchanged), stored `{id}`. Route permission create / update / read. Result inline only
  (`TestConnectionButton`); HTTP errors read from the body's `error` (`readTestConnectionError`).
- Delete: Foundation "Soft delete and force"; typed-name confirmation, `allowForceDelete: false`
  (`useLogSinkDeleteConfirmation`); the controller has no force-annotation handling.
- YAML: kind not in `EXPORTABLE_RESOURCES`; import path not checked (no log-sink code under `domains/log-sink`).

## Descriptions

- `metadata.name`: `required` and `RESOURCE_NAME_PATTERN` (`namePattern`); no length cap. `spec.enabled`: `Switch`.
- VictoriaLogs: `url` `validateSinkUrl` (required, scheme, host, query or fragment); username required (trimmed); token
  required unless a stored bearer token is kept; password optional; `timeout_seconds` `validateTimeoutSeconds`
  (`^\d+$`); `extra_fields` `validateExtraFieldKey` (required for a non-blank row, no `,` `=`, unique) and
  `validateExtraFieldValue` (no `,`); `ca_cert` free text, no PEM check.
- S3: `endpoint` `validateS3Endpoint` (optional; scheme, host, no credentials / query / fragment); `region`, `bucket`
  required only; `key_prefix` `validateKeyPrefix` (<= 512, no leading `/`, no `{{ }}`, no control chars or `\`); keys
  required on create; `flush_interval_seconds` `validateFlushInterval` (integer 1..86400).
- `spec.buffer.max_size_gib`: `validateBufferGib` (positive, at least 268435488 bytes).

## Overrides

- Secret omission is by blankness only: `toS3SinkSpec` / `toVictoriaLogsSinkSpec` drop a blank secret, so shared
  `omitEmptyUntouched` (sends `""` for touched-then-emptied) is not used. The wire effect would be the same
  (`isEmptyValue`) but the payload would change, hence not switched.
- Edit sends `{spec}` only, not the whole record (Foundation "Edit PATCH" does not apply): a code comment says PATCH
  replaces metadata whole; reason beyond that unknown.
- API-filled defaults are omitted, so a stored explicit default (`force_path_style: true`, `compression: "gzip"`, `auth:
  {type: "none"}`) reads back as absent after one edit; semantically equal (`UsePathStyle`, `GetCompression`, "auth
  removed").
- Form-only shape: GiB string, `extra_fields` as rows, flat secrets, `id` carried through `select` for the connection
  test.
- Validation stricter than the API on purpose (URL query / fragment, endpoint credentials, key prefix, extra fields):
  code comments say these are controller rules the write path does not check.

## Error mapping

`LOG_SINK_ERROR_FIELDS` (`lib/log-sink-form.ts`), applied by `onMutationError` through `getApiErrorCode` ->
`form.setError(field, {type: "server"})` with the server message; whether the notification provider also toasts is not
traced.

| code | meaning (`validate_log_sink_spec`) | field |
|---|---|---|
| 10243 | invalid type | `spec.type` |
| 10244, 10245 | VictoriaLogs URL required / scheme | `spec.victorialogs.url` |
| 10246 | auth type invalid | `spec.victorialogs.auth.type` |
| 10247 | basic needs username | `spec.victorialogs.auth.username` |
| 10248 | bearer needs token | `spec.victorialogs.auth.token` |
| 10249 | buffer below 268435488 | `spec.buffer.max_size_gib` |
| 10305 | s3 missing or wrong JSON type | `spec.type` (shape errors the form cannot produce) |
| 10306 | bucket required | `spec.s3.bucket` |
| 10307 | region required | `spec.s3.region` |
| 10308 | endpoint scheme | `spec.s3.endpoint` |
| 10309 | compression invalid | `spec.s3.compression` |
| 10310 | flush interval | `spec.s3.flush_interval_seconds` |
| 10311 | both S3 keys required | `spec.s3.auth.access_key_id` (message names both; secret key not marked) |

Unmapped: 10327, 10001 / 10003 / 10004, duplicate name (23505 / 409). Test-connection failures are `{"error": ...}`
bodies or `ok:false` results shown inline.

## Known deviations

1. Bucket-name rule 10327 has no client check and no field mapping.
   - UI: `bucket` only requires non-blank (`requiredText`, `validation.bucketRequired`); `LOG_SINK_ERROR_FIELDS` has no
     10327.
   - API: `validate_log_sink_spec` (`135_log_sink_s3_bucket_name`) rejects spaces, control chars, `/`, over 63
     characters, and AWS naming without an endpoint, only on INSERT or when bucket or endpoint changed.
   - Effect: the message appears only as the generic notification, not on the field (notification inferred). Ticket: TBD
2. Name rule gaps: length and server codes.
   - UI: `RESOURCE_NAME_PATTERN` has no 63-character limit (`foundation/role/validate.ts`); no mapping for 10001 / 10003
     / 10004.
   - API: `validate_metadata_name` raises 10004 above 63 characters.
   - Effect: a 64+ character name passes the form and fails on submit without a field error. Ticket: TBD
3. A duplicate name is not mapped to the name field.
   - UI: no handling of 409 / 23505 in `onMutationError`.
   - API: unique index `log_sinks_name_unique_idx` on `(metadata).name` (`115_log_sinks`).
   - Effect: generic failure notification only. Ticket: TBD
4. Error 10311 marks only the access key field.
   - UI: `LOG_SINK_ERROR_FIELDS["10311"]` is `spec.s3.auth.access_key_id`.
   - API: the check is `access_key_id` blank or `secret_access_key` empty, one message for both.
   - Effect: when only the secret key is missing the error lands on the other field. Unreachable on create (both
     required client-side) and on edit (backfilled). Ticket: TBD

Not deviations (traced): a stored secret survives an untouched edit and an enable / disable; `{type: "none"}` auth is
dropped by the trigger's "auth removed" branch; absent `enabled` becomes `true`, as `IsEnabled` reads it.

## Open points

- Whether the shared notification provider also toasts the mapped errors was not traced.
- Controller-only rules (CA PEM, key prefix) surface as a Failed status, not at save; the status message path was not
  traced.
