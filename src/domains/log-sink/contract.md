# Log Sink contract

Backend: Go `v1.LogSink` (`api/v1/log_sink_types.go`), table `api.log_sinks` (composite types `api.log_sink_spec`,
`api.log_sink_status` from `115_log_sinks`, `s3` attribute added by `117_log_sink_s3`; `validate_log_sink_spec` last
redefined by `135_log_sink_s3_bucket_name`), served through the resource proxy `/api/v1/log_sinks`
(`internal/routes/proxies/log_sink_proxy.go`, `RegisterLogSinkRoutes`: GET, POST and PATCH only, no DELETE route; deleting is a
soft-delete PATCH). Extra route used by the UI: `POST /log_sinks/test_connection` (`handleLogSinkTestConnection`). Reconciled by
`controllers/log_sink_controller.go` (Vector config from `internal/observability/logsink`). No RPCs. A global resource:
`validate_log_sink_spec` clears `metadata.workspace`, so the UI has no workspace field or column. Permissions
`log_sink:read|create|update|delete` (RLS in `115`, enum in `114`), `log_sink:read-credentials` (only the credentials API
`/credentials/log_sinks`, which the UI does not call). Refine resource `log_sinks`: `idColumnName: "metadata->name"`.

## Type

UI type: `src/domains/log-sink/types.ts` (`LogSink`, `LogSinkSpec`, `VictoriaLogsSinkSpec`, `S3SinkSpec`, `LogSinkAuth`,
`LogSinkStatus`). Form type: `LogSinkFormValues` (`lib/log-sink-form.ts`), converted by `toLogSinkFormValues` /
`toLogSinkSpec`.

| path | type | required | default | owner | secret | editable after create | backend rule |
|---|---|---|---|---|---|---|---|
| `metadata.name` | string | yes | `""` | user | no | no (input disabled) | `validate_metadata_name`: 10001 empty, 10003 not `^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$`, 10004 over 63; unique index `log_sinks_name_unique_idx` (duplicate -> PostgREST 409) |
| `metadata.workspace` | - | no | - | server | no | - | cleared by `validate_log_sink_spec` |
| `metadata.creation_timestamp` | timestamp | - | - | server | no | no | trigger |
| `spec.type` | `victorialogs` / `s3` | yes | `victorialogs` | user | no | no (select disabled) | 10243. PATCH may change it; the trigger keeps only the chosen type's settings |
| `spec.enabled` | bool | no | form `true` | user | no | yes (form switch; list/show action) | `coalesce(enabled, true)`; Go `IsEnabled` reads nil as true |
| `spec.victorialogs.url` | string | yes for victorialogs | `""` | user | no | yes | 10244 blank, 10245 not `^https?://`; controller `validateVictoriaLogs`: http(s) with host, no query or fragment |
| `spec.victorialogs.ca_cert` | PEM string | no | absent | user | no | yes | none at write time; controller rejects a value with no valid PEM |
| `spec.victorialogs.insecure_skip_verify` | bool | no | absent (false) | user | no | yes | none |
| `spec.victorialogs.timeout_seconds` | int | no | absent (backend default) | user | no | yes | controller: not negative |
| `spec.victorialogs.auth.type` | `none` / `basic` / `bearer` | no | absent | user | no | yes | 10246 |
| `spec.victorialogs.auth.username` | string | yes for basic | absent | user | no | yes | 10247 |
| `spec.victorialogs.auth.password` | string | no | absent | user | yes (`api:"-"` on `LogSinkAuth.Password`) | yes, write-only | none; kept by the PATCH backfill, see Scenes (Edit) |
| `spec.victorialogs.auth.token` | string | yes for bearer | absent | user | yes (`api:"-"` on `LogSinkAuth.Token`) | yes, write-only | 10248 (checked after the backfill, so a stored token satisfies it) |
| `spec.victorialogs.extra_fields` | `Record<string,string>` | no | absent | user | no | yes | controller: key non-empty without `,` `=`, value without `,` |
| `spec.s3.endpoint` | string | no | absent (AWS endpoint of the region) | user | no | yes | 10308 when non-empty and not `^https?://`; controller: http(s) with host, no credentials, query or fragment |
| `spec.s3.region` | string | yes | `""` | user | no | yes | 10307 |
| `spec.s3.bucket` | string | yes | `""` | user | no | yes | 10306 blank; 10327 (`135`) on INSERT or when bucket or endpoint changed: no whitespace, control chars or `/`, at most 63; AWS naming `^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$` when no endpoint |
| `spec.s3.key_prefix` | string | no | absent (`traces/%Y/%m/%d/`, `GetKeyPrefix`) | user | no | yes | none at write time; controller: no `{{ }}` |
| `spec.s3.force_path_style` | bool | no | absent (true, `UsePathStyle`) | user | no | yes | 10305 if not bool/null |
| `spec.s3.compression` | `gzip` / `zstd` / `none` | no | absent (gzip) | user | no | yes | 10309 |
| `spec.s3.flush_interval_seconds` | int | no | absent (300, `GetFlushIntervalSeconds`) | user | no | yes | 10310: integer 1..86400 |
| `spec.s3.auth.access_key_id` | string | yes | absent | user | yes (`api:"-"` on `S3SinkAuth.AccessKeyID`) | yes, write-only | 10311 (after backfill) |
| `spec.s3.auth.secret_access_key` | string | yes | absent | user | yes (`api:"-"` on `S3SinkAuth.SecretAccessKey`) | yes, write-only | 10311 (after backfill) |
| `spec.buffer.max_size` | int bytes | no | absent (1 GiB, `GetMaxSize`) | user | no | yes | 10249: number >= 268435488 |
| `status.phase` | `Pending` / `Running` / `Degraded` / `Failed` / `Disabled` / `Deleted` | - | - | server | no | no | controller |
| `status.error_message`, `status.last_transition_time` | string | - | - | server | no | no | controller |
| `status.sent_events`, `status.dropped_events` | int64 | - | omitted when 0 | server | no | no | controller |
| `status.last_sent_time` | timestamp | - | - | server | no | no | controller |
| `status.last_connection_test` | `{time, ok, message}` | - | - | server | no | no | controller, not the test route |
| `status.observed_hash`, `status.component_id` | string | - | - | server | no | no | not in the UI type |

Masked fields: `LogSinkAuth.Password`, `LogSinkAuth.Token`, `S3SinkAuth.AccessKeyID`, `S3SinkAuth.SecretAccessKey` are tagged
`api:"-"`, so `filterObject` removes them from every response (an S3 `auth` therefore reads as `{}`, inferred from the filter, not run).
No array carries a `mergekey`: the only collection, `extra_fields`, is a map without masked values.

## Roles

- Status tone: `LogSinkStatus` over `BaseStatus`, label `status.phases.logSink.<phase>`. Tones from shared `STATUS_TONE`
  (`foundation/lib/status-tone.ts`): Running positive, Failed serious, Degraded and Pending notice, Disabled and Deleted
  neutral (pinned by `LogSinkStatus.test.tsx`). An absent phase renders `EmptyValue` (`BaseStatus`); an unknown phase has no
  tone class. The list renders the chip from `status` always; the show header too.
- Time: `Timestamp` (relative) for last sent time and last connection test time; `MetadataTimestampMeta` in the show header.
- Name / actions columns: `useMetadataColumns().name`; no workspace column (global resource).
- Counters: `formatEventCount` (`en-US` grouping, absent as 0, because the API omits zero counters).
- Buffer size: `bytesToGib` / `gibToBytes` (GiB in the form, bytes on the wire); show prints `log_sinks.values.bufferGib`,
  absent prints `bufferDefault`.
- Enabled: `isLogSinkEnabled` (only an explicit `false` is off), shown as yes / no (`log_sinks.values.yes|no`).
- Destination cell: `formatLogSinkDestination` (victorialogs URL; `s3://<bucket>/<prefix or default>` plus endpoint host).
- Secret input: `<Input type="password" autoComplete="new-password">` with hint `common.messages.leaveEmptyToKeepValue` on edit;
  blank means keep (own mechanism, see Overrides and Known deviations).
- Empty marker: `EmptyValue` for a basic username missing and for no extra fields; default markers by field as
  `withDefault` / `defaultSuffix` strings.
- Auth type: `toAuthType` (anything but basic/bearer is none).

## Scenes

- List (`pages/log-sinks/list.tsx`): columns name (link), type, destination, status, enabled, sent events, dropped events, last
  sent time (all hideable), actions. Default sorter `metadata->name` asc, sorting, filters, search on `metadata->>name`, empty
  text `log_sinks.empty`. No batch delete. Row actions: edit, enable / disable (`LogSinkEnableAction`), delete. No polling here
  (the AI traces button polls every 15 s through `summarizeForwarding`: enabled count, Failed beats Degraded as the alert).
- Show (`pages/log-sinks/show.tsx`): header name, status chip, enabled, timestamps; destination section differs by type
  (s3: endpoint or default, region, bucket, key prefix or default, addressing, compression, flush interval, buffer;
  victorialogs: URL, auth type, username, skip verify, CA set / not set, timeout, buffer, extra fields as `key=value` chips);
  delivery section (counters, last sent, last connection test with message) and a "test connection" button for the stored
  sink (`{id}` only). Secrets are never shown. Show actions: edit, enable / disable, delete.
- Create (`create.tsx` + `hooks/use-log-sink-form.tsx`): basic information (name, enabled switch), destination (type, then the
  type's fields, test connection), advanced (compression / flush interval, timeout, buffer, path style or skip verify / CA /
  extra fields). Starts as victorialogs, enabled, s3 path style on, compression gzip. Payload `toLogSinkPayload(values,
  "create")`: `{api_version, kind, metadata:{name: trimmed}, spec}`.
- Edit (`edit.tsx`): same form. Locked: name, type. Prefilled from the record through `select` -> `toLogSinkFormValues`
  (blank secrets, auth type from the record, buffer in GiB, extra fields as rows, `cacheTime: 0`). Save sends only
  `{spec}` (`toLogSinkPayload(values, "edit")`; the PATCH replaces the `spec` column whole, so every kept value is sent, and
  `metadata` is not sent). Only the chosen type's settings go out. Defaults the API fills are left out when equal to the
  default (`force_path_style` true, `compression` gzip, blank ca_cert, 0 timeout / flush, blank buffer). Blank-key extra
  rows are dropped; `enabled` is always sent (an absent stored value is written back as `true`).
  - Secret handling, traced through `handlePatchWithBackfill` -> `mergeExcludedFields` (`isEmptyValue` treats a missing
    key or `""` as empty) and `validate_log_sink_spec`: a blank secret is omitted from the payload and the proxy backfills the
    stored value; for an omitted `auth` object the proxy creates `auth` with just the stored secrets and the trigger, seeing no
    `type`, removes it (the "auth removed" branch, so `none` works); for S3 the missing `auth` is rebuilt from both stored keys,
    a lone typed key keeps the other stored one. Stored secrets of the type no longer used are stripped by the trigger.
    The password / token / keys therefore can be replaced but never cleared in place; the workaround is switching auth type
    to none and back. UI rules follow: bearer token required unless the stored auth type is bearer (`tokenRequired`), S3 keys
    required on create only.
- Enable / disable (`LogSinkEnableAction`, list and show): PATCH `{spec: {...record.spec, enabled: !enabled}}` with
  `idColumnName: "metadata->name"`, pessimistic. The spec comes from a read, so secrets are absent and backfilled by the proxy.
- Test connection (`useLogSinkTestConnection`, `buildTestConnectionRequest`): create `{spec}`, edit `{id, spec}` (the spec the
  submit would save; blank secrets are filled by `backfillLogSinkSecrets` / `backfillS3Keys` only when type and VictoriaLogs
  auth type are unchanged), stored `{id}` (show page). Permissions picked by the route: create / update / read. Result is
  inline only (`TestConnectionButton`); the form clears it on any value change. HTTP errors are read from the body's `error`
  (`readTestConnectionError`).
- Delete: soft delete (PATCH `metadata.deletion_timestamp`) through the shared delete provider and `DeleteConfirmDialog`,
  typed-name confirmation, `allowForceDelete: false` (`useLogSinkDeleteConfirmation`); the controller has no force-delete
  annotation handling (grep of `log_sink_controller.go`). The soft-delete PATCH skips the backfill (`IsSoftDeleteRequest`).
- YAML: not examined (no log-sink specific code under `domains/log-sink`).

## Descriptions

- `metadata.name`: `common.fields.name`, placeholder `log_sinks.placeholders.name`; `required` and `RESOURCE_NAME_PATTERN`
  (`namePattern` message); no length cap.
- `spec.enabled`: label and description `log_sinks.fields|descriptions.enabled`, `Switch`.
- `spec.victorialogs.url`: `validateSinkUrl` (required, scheme, invalid, host, query or fragment).
- `spec.victorialogs.auth.*`: username required (`requiredText`, trimmed); token required unless a stored bearer token is kept;
  password optional.
- `spec.victorialogs.timeout_seconds`: `validateTimeoutSeconds` (`^\d+$`); `extra_fields`: `validateExtraFieldKey` (required when the
  row is not blank, no `,` `=`, unique) and `validateExtraFieldValue` (no `,`).
- `spec.s3.endpoint`: `validateS3Endpoint` (optional; scheme, host, no credentials / query / fragment); `region`, `bucket`: required
  only (trimmed); `key_prefix`: `validateKeyPrefix` (max 512, no leading `/`, no `{{ }}`, no control chars or `\`); keys:
  required on create; `flush_interval_seconds`: `validateFlushInterval` (integer 1..86400).
- `spec.buffer.max_size_gib`: `validateBufferGib` (positive number, at least 268435488 bytes).
- `ca_cert`: free text, no PEM check.

## Overrides

- Secret omission is by blankness only, not by touched state: `toS3SinkSpec` / `toVictoriaLogsSinkSpec` drop a blank secret, so
  the shared `omitEmptyUntouched` (which sends `""` for a touched-then-emptied secret) is not used. The two differ only for a
  secret typed and then emptied; the API treats `""` and missing the same (`isEmptyValue`), so the wire effect would be the
  same, but the payload would change, hence not switched.
- Edit sends `{spec}` only, not the whole record (Foundation "Edit PATCH" does not apply): the code comment says PATCH replaces
  metadata whole; reason beyond that unknown.
- Defaults the API fills are omitted rather than echoed (see Scenes), so a stored explicit default (`force_path_style: true`,
  `compression: "gzip"`, `auth: {type: "none"}`) reads back as absent after one edit; semantically equal (`UsePathStyle`,
  `GetCompression`, trigger "auth removed" branch).
- Form-only shape: GiB string for the buffer, `extra_fields` as rows, secrets as flat strings, `id` carried through `select` for
  the connection test (not sent on save).
- Validation stricter than the API on purpose (URL query / fragment, endpoint credentials, key prefix, extra fields): the code
  comments say these are the controller's rules, which the write path does not check.
- Time, counters and buffer use local formatters (`formatEventCount`, GiB), not shared roles.

## Error mapping

`LOG_SINK_ERROR_FIELDS` (`lib/log-sink-form.ts`), applied by `onMutationError` through `getApiErrorCode` -> `form.setError(field,
{type: "server"})` with the server message; the shared notification provider also reports the failure (inferred, not traced).

| code | meaning (`validate_log_sink_spec`) | field |
|---|---|---|
| 10243 | invalid type | `spec.type` |
| 10244, 10245 | VictoriaLogs URL required / scheme | `spec.victorialogs.url` |
| 10246 | auth type invalid | `spec.victorialogs.auth.type` |
| 10247 | basic needs username | `spec.victorialogs.auth.username` |
| 10248 | bearer needs token | `spec.victorialogs.auth.token` |
| 10249 | buffer below 268435488 | `spec.buffer.max_size_gib` |
| 10305 | s3 missing or wrong JSON type | `spec.type` ("shape errors the form cannot produce") |
| 10306 | bucket required | `spec.s3.bucket` |
| 10307 | region required | `spec.s3.region` |
| 10308 | endpoint scheme | `spec.s3.endpoint` |
| 10309 | compression invalid | `spec.s3.compression` |
| 10310 | flush interval | `spec.s3.flush_interval_seconds` |
| 10311 | both S3 keys required | `spec.s3.auth.access_key_id` (message names both; secret key not marked) |

Raised by the kind but not mapped: 10327 (bucket name, `135`), 10001 / 10003 / 10004 (name, `validate_metadata_name`),
duplicate name (unique index, PostgREST 23505 / 409). Test-connection failures are not codes: `{"error": ...}` bodies and
`ok:false` results show inline.

## Known deviations

1. Bucket-name rule 10327 has no client check and no field mapping.
   - UI: `bucket` only requires non-blank (`requiredText`, `validation.bucketRequired`); `LOG_SINK_ERROR_FIELDS` has no 10327.
   - API: `validate_log_sink_spec` (`135_log_sink_s3_bucket_name`) rejects spaces, control chars, `/`, over 63 characters, and AWS
     naming without an endpoint, only on INSERT or when bucket or endpoint changed.
   - Effect: the message appears only as the generic notification, not on the bucket field (notification inferred). Ticket: TBD
2. Name rule gaps: length and server codes.
   - UI: `RESOURCE_NAME_PATTERN` has no 63-character limit (`foundation/lib/validate.ts`); no mapping for 10001 / 10003 / 10004.
   - API: `validate_metadata_name` raises 10004 above 63 characters.
   - Effect: a 64+ character name passes the form and fails on submit without a field error. Ticket: TBD
3. A duplicate name is not mapped to the name field.
   - UI: no handling of 409 / 23505 in `onMutationError`.
   - API: unique index `log_sinks_name_unique_idx` on `(metadata).name` (`115_log_sinks`).
   - Effect: generic failure notification only. Ticket: TBD
4. Error 10311 marks only the access key field.
   - UI: `LOG_SINK_ERROR_FIELDS["10311"]` is `spec.s3.auth.access_key_id`.
   - API: the check is `access_key_id` blank or `secret_access_key` empty, one message for both.
   - Effect: when only the secret key is missing the error lands on the other field. Unreachable on create (both required
     client-side) and on edit (backfilled); the form cannot trigger it. Ticket: TBD

Not deviations (traced): a stored secret survives an untouched edit and an enable / disable (see Scenes); the `{type: "none"}`
auth is dropped by the trigger's "auth removed" branch; absent `enabled` becomes `true`, as `IsEnabled` already reads it.

## Open points

- Whether the shared notification provider also toasts the mapped errors was not traced.
- YAML import / export for kind `LogSink` was not checked.
- Controller-only rules (CA PEM, key prefix) surface as a Failed status, not at save; the status message path was not traced.
