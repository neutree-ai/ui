# Identity Source contract

Backend: `v1.IdentitySource` (`api/v1/identity_source_types.go`), `api.identity_sources`, encrypted
`api.identity_source_secrets` (`105_identity_sources`), sync composites (`121_identity_source_sync`).
`RegisterIdentitySourceRoutes` / `checkIdentitySourcePayload` (`internal/routes/proxies/identity_source_proxy.go`):
GET/POST/PATCH. RPCs: `request_identity_source_sync`, `list_login_identity_sources`.
`identity_source:read|create|update|delete` (`104`, `105`). UI `src/domains/identity-source/`,
`src/pages/identity-sources/`; resource `identity_sources`, key `metadata->name`. Backend `origin/main@062192f6`.

## Type

`types.ts`; `IdentitySourceFormValues` (`lib/identity-source-values.ts`). `L=spec.ldap`, `O=spec.oidc`,
`S=L.sync`. User/editable/unmasked unless noted; UI defaults. B =
`identity_sources_before_write` (`105`); Y = `identity_sources_sync_before_write` (`139`).

| path | type | required/default | owner/secret/edit exception | backend rule |
|---|---|---|---|---|
| `id`, `api_version`, `kind` | int/strings | serial, v1, IdentitySource | server/header; locked | NOT NULL headers |
| `metadata.name` | string | yes/blank | locked | DNS label 1..32; 10250/10251; unique index |
| `metadata.display_name` | string | blank | — | B blank → name |
| `metadata.workspace` | string/null | absent | server; locked | B 10252; stored null |
| `spec.type` | ldap/oidc | ldap | locked | type/matching object; 10253/10251 |
| `spec.enabled` | bool | true | — | B null → false |
| `L.url` | URL | yes/blank | — | LDAP validator; ldap(s), host; 10256 |
| `L.start_tls`, `.insecure_skip_verify` | bool | false | — | B StartTLS + ldaps 10258 |
| `L.timeout` | seconds | 10 | — | B nonnegative; zero/null → 10; 10258 |
| `L.ca_cert`, `O.ca_cert` | PEM | blank | — | `validateCACert`; parsed X.509; SQL marker; 10261/10258 |
| `L.bind_dn`, `.user_base_dn` | string | yes/blank | — | B nonblank 10255 |
| `L.bind_password` | string | create/blank | secret; replace only | encrypted; empty keeps; B 10255/10259 |
| `L.user_filter` | string | `(uid={username})` | — | B placeholder 10257 |
| `L.attributes.{id,username,email,display_name,member_of}` | strings | entryUUID, uid, mail, cn, blank | — | B blank → defaults |
| `O.issuer`, `.redirect_url` | URL | yes/blank, callback | — | OIDC validator; http(s); 10256 |
| `O.client_id` | string | yes/blank | — | B nonblank 10255 |
| `O.client_secret` | string | UI create/blank | secret; replace only | API optional; encrypted |
| `O.scopes` | string[] | openid, profile, email | — | B empty → defaults; openid 10257 |
| `O.claims.{username,display_name,email}` | strings | preferred_username, name, email | — | B blank → defaults |
| `O.allowed_redirects` | URL[] | deployment root | — | B nonempty 10255; no user/query/fragment 10256 |
| `spec.sync.{enabled,interval}` | bool/seconds | false/3600 | LDAP input | Y zero/null → 3600; min 60; 10262 |
| `spec.sync.requested_at` | time | absent | RPC; carried | `request_identity_source_sync` |
| `S.{org_unit_base_dn,group_base_dn}` | strings | blank | — | Y one required when enabling/changing; 10330 |
| `S.{org_unit_filter,org_unit_name_attribute,group_filter,group_name_attribute,group_member_attribute}` | strings | blank | — | Y trimmed/null |
| `S.{user_list_filter,disabled_user_filter}` | strings | blank | — | Y first forbids username placeholder; 10262 |
| `S.page_size` | int | blank | — | Y nonnegative; zero → null; 10262 |
| `status.phase` | Pending/Connected/Failed/Deleted | optional | server; locked | `testedStatus` / `syncDeletion` |
| `status.{error_message,last_transition_time,last_connection_test,last_sync}` | message/time/results | optional | server; locked | `IdentitySourceStatus`; `testedStatus`, `runSync` |

## Roles

- `IdentitySourceStatus` (own chip, tone from `lib/phases.ts` `identitySourcePhases`): Connected positive, Failed serious, Pending notice, Deleted neutral;
  `identity_sources.phases.<phase>`, missing `-`, unknown no tone.
- `IdentitySourceSyncResult` → `STATUS_TONE`: ok positive, failed serious, pending notice; `syncResultOf` prefers
  pending request, else finished outcome. `IdentitySourceLastSync` adds relative finish time.
- Shared `Timestamp`, `MetadataTimestampMeta`, `useMetadataColumns`, `EmptyValue`, `displayName`;
  list fallback `display_name || name`; password inputs; lists `StringListInput`.

## Scenes

- List (`IdentitySourcesList`): name/display name/type/enabled/status/last sync/created/actions; name search,
  created descending (`defaultSorters`), filters/sorting, edit/delete, no batch actions; poll 10s.
- Show (`IdentitySourcesShow`): `DetailFields` over `lib/detail-fields.tsx` (header name/type; state: enable
  switch, connection result via `role/ConnectionTestResult`, message = `status.error_message` or else the test message; LDAP or OIDC settings),
  plus LDAP sync; no secrets or attribute/claim mappings. Values go through `FieldValue` (Foundation "Detail
  fields"): TLS switches yes / no (unset = no), scopes and allowed redirects comma-joined, absent values the empty
  marker; CA is `caConfigured` or `systemTrust`. Tests: `lib/detail-fields.test.ts`. Pending poll 3s, else 10s.
- Forms (`useIdentitySourceForm`): `mode:"all"`; `select` → `toFormValues` fills nulls/defaults, both protocols,
  blank secrets. Edit locks name/type. `toIdentitySourcePayload`: chosen settings, opposite null.
- Create `{api_version:"v1",kind:"IdentitySource",metadata:{name,display_name},spec}`; edit `{metadata,spec}`.
  Trim create name, display name/URLs/CA/lists/sync text; numeric fields; whole edit metadata.
- LDAP always sends sync/settings, even disabled, preserving request time or null; OIDC omits sync (Y retains it).
- `IdentitySourceEnabledSwitch`: PATCH `{spec:{...record.spec,enabled:checked}}`; disabled saving/deleting.
  `IdentitySourceSyncNowButton`: RPC POST `{p_name:name}`, invalidate list/detail; global update permission.
- Sync now disabled unless enabled LDAP sync and not deleted/pending/loading. Controller `syncDue` also handles
  first sync, spec/secrets changes and intervals; tests via `testDue`.
- Delete: `src/foundation/contract.md` “Soft delete and force”; no pre-check/force handling (`syncDeletion`).
- YAML: `src/foundation/contract.md` “YAML import and export”; generic pluralization; no export option.

## Descriptions

`useIdentitySourceForm`: `identity_sources.fields.*`/`.hints.*`, `adminEquivalent` warning.
Required fields: `validation.required`; edit secrets: `hints.keepSecret`.
`lib/identity-source-values.ts`: DNS label, LDAP prefix, HTTP URL, redirects, username placeholder, openid, PEM marker,
interval integer >=60, page size integer >=0; timeout blank/null or integer >=0. StartTLS/ldaps rejected.
Sync requires either base DN. Placeholders: page size 500, user filter with username replaced by `*`; blanks sent.

## Overrides

- Blank secrets omitted regardless of touch; `omitEmptyUntouched` changes emptied-field payloads.
- Edit flow: `src/foundation/contract.md` “Edit PATCH”; no id/status/header echo.
- Create enabled true vs SQL false; custom connection status. Reasons unknown.
- Callback REST + `/auth/oidc/callback`; root redirects: login prefix check (hook comment).

## Error mapping

Toast path: `src/foundation/contract.md` “Error toast path”. `identitySourceErrorMessage` /
`IDENTITY_SOURCE_ERROR_KEYS` (`lib/identity-source-errors.ts`): translated toasts, no field mapping.
`10250..10259`: name/immutable/workspace/type/mismatch/required/URL/placeholder/TLS/encryption; `10261` invalid;
`10262` sync; `10263` missing; `10264` sync off; `10304` paused; `10330` base DN. Others: `getErrorMessage`.

## Known deviations

1. `useIdentitySourceForm` requires OIDC client_secret on create; `IdentitySourceOIDCSpec.validate` and
   `identity_sources_before_write` (`105`) allow none. Public clients blocked. Ticket: TBD
2. `isPemBundleOrEmpty` accepts a marker alone; `isLdapUrl` accepts an unparsed prefix.
   `validateCACert` parses X.509; `IdentitySourceLDAPSpec.validate` parses URLs.
   Locally accepted junk fails with 10261 toast. Ticket: TBD
3. `useIdentitySourceForm.syncBaseDnValidate` always requires bases with sync enabled;
   `identity_sources_sync_before_write` (`139`) grandfathers previously enabled empty bases.
   Unrelated edits blocked. Ticket: TBD
4. `isValidSyncInterval(0)` rejects zero; `IdentitySourceSyncSpec.validate` and
   `identity_sources_sync_before_write` accept zero as 3600. API default sentinel blocked. Ticket: TBD
5. `isAllowedRedirectUrl` rejects any @/?/#; `IdentitySourceOIDCSpec.validate` checks parsed user/query/fragment.
   Valid `https://ui.example.org/a@b` path blocked. Ticket: TBD

## Secret payload trace

Shared backfill: `src/foundation/contract.md` “Masked fields”, “Backfill preconditions”, “Masked fields inside arrays”.
`fetchCurrentResource`: null secrets; `checkIdentitySourcePayload` precedes merge.
Let B be edit `{metadata:stored,spec:{type:"ldap",enabled,ldap:L,oidc:null,sync:Q}}`, C be edit
`{metadata:stored,spec:{type:"oidc",enabled,ldap:null,oidc:O}}`; L/O are normalized settings without secret;
Q is `{enabled,interval,requested_at}`. Exact bodies: `lib/identity-source-values.test.ts`.

| case | LDAP body | OIDC body | result |
|---|---|---|---|
| untouched reopen | B; password absent | C; secret absent | null leaf; ciphertext kept |
| typed | B + `L.bind_password:"new"` | C + `O.client_secret:"new"` | encrypted replacement |
| typed then emptied | B; password absent | C; secret absent | ciphertext kept |
| null | B; password absent | C; secret absent | ciphertext kept |
| partial nested read | attributes `{id:"uuid"}` filled | claims `{username:"sub"}` filled | sibling defaults; secret kept |

`mergeExcludedFields` recurses L/O independently: absent/empty leaf (`isEmptyValue`) becomes stored null;
`"new"` survives. Only leaves are excluded; partial L/O cannot cause Image Registry's whole-authconfig loss.
Missing required siblings fail protocol validators before merge. `mergeArrayByIdentity` is unreachable: neither
secret has an array ancestor. `identity_sources_before_write` uses NULLIF(secret,'') and encrypted COALESCE
for each secret; no clear operation. This matches the edit hint, not a deviation.

## Open points

Live API/sync and concurrent writes untested.
