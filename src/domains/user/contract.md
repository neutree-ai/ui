# User contract

Backend: `v1.UserProfile`, `UserProfileSpec`, `UserProfileStatus` (`api/v1/user_profile_types.go`),
`api.user_profiles` (`002_user-extend`, `036_user_profile_status_fix`). `RegisterUserProfileRoutes`
(`internal/routes/proxies/user_profile_proxy.go`): GET/POST/PATCH. Local creation uses
`RegisterAuthRoutes` / `handleCreateUser` (`internal/routes/auth/auth.go`), POST `/api/v1/auth/admin/users`.
Permissions: `user_profile:read|create|update|delete`; read/update may be department-scoped (`125`, `131`).
Refine resource `user_profiles`, global, key `metadata->name`; UUID `id` identifies memberships and grants.
Backend: `origin/main@062192f6`; no User RPCs.

## Type

UI: `src/domains/user/types.ts`; creation uses flat auth fields.
Optional fields default to absent/null; editability describes these pages.

| path | type | required/default | owner | secret | edit | backend rule |
|---|---|---|---|---|---|---|
| `id` | UUID string | auth-generated | server | no | no | auth user foreign key (`002`) |
| `metadata.name` | string | create blank | user or server | no | no | `validate_user_profile_name_immutable` 10265 (`111`) |
| `metadata.display_name` | string | username or IdP claim | user or source | no | no UI | `handle_new_user` (`107`); `UpdateExternalUser` |
| `metadata.labels` | string map | empty map | user and server | no | no UI | `apply_user_profile_identity_source` (`108`) |
| `metadata.deletion_timestamp` | timestamp | absent | user | no | delete action | `validate_user_profile_soft_delete` (`034`) |
| `spec.email` | string/null | create blank | user or source | no | local only | `apply_user_profile_identity_source` 10260 |
| `status.phase` | Pending/Created/Failed/Deleted | server | server | no | no | `UserProfileController.sync` |
| `status.synced_spec.email` | string | last synced email | server | no | no | `UserProfileStatus.SyncedSpec` |
| create `name`, `email` | strings | blank | user | no | create only | `CreateUserRequest`, `createUser` |
| create `password` | string | blank | user | write-only | create only | `CreateUserRequest.Password` required |
| create `confirmPassword` | string | blank | user | input only | create only | no API field |
| create `orgUnit` | department name | blank | user | no | create only | separate membership write |

`metadata.name` is globally unique (`user_profiles_name_unique_idx`, `002`). `validate_metadata_name`
(`004_required_fields`) requires nonblank, at most 63 characters and lowercase DNS-style names allowing dots.
`handle_new_user` (`107`) copies username or uses `derive_user_profile_name` (`102`) for IdP claims.

## Roles

- Identity presentation: `src/foundation/lib/user-identity.ts`, tested in `user-identity.test.ts`.
  `profileDisplayName` trims the human name and falls back to the technical name; `profileEmail` hides placeholders.
- `profileIdentitySource` reads `neutree.ai/identity-source`; `profileIdentitySourceName` prefers the source-name label,
  falling back to the type. Missing source displays `user_profiles.values.local`.
- Columns: `useMetadataColumns`; time: `MetadataTimestampMeta`; empty email/department: `EmptyValue`.
- Department path: `orgUnitPathLabel`, tested in `domains/organization/lib/org-tree.test.ts`.
  Missing ancestors are omitted; missing membership displays empty.
- No status role is rendered. Password and confirmation inputs use `type="password"`.

## Scenes

- List (`src/pages/users/list.tsx:UsersList`): name, display name, email, source, department, created, actions;
  search technical name, `defaultSorters` newest created first, sorting/filters and batch delete; row edit/delete.
  Select is `*,org_unit_members(org_units(id,metadata,status,path))`; department needs `org_unit:read`.
- `UserSourceFilter`: all/local/named; named options need `identity_source:read`. Local filters source-name label
  null; named uses equality on `metadata->labels->>"neutree.ai/identity-source-name"`.
- Show (`UsersShow`): human/technical names, email, source, timestamps; department, teams, effective grants and model
  access use their domain components; grant tables separate global, workspace and department assignments.
- Create (`useUserForm`, `UsersCreate`): flat auth fields; `mode:"all"`, unsaved-change warning.
  `dataProvider.create` sends only `{email,password,username:name}`.
- Department on create: picker only with global `org_unit:assign-member`; `onMutationSuccess` passes returned UUID
  and selected name to `UsersCreate.onCreated`; membership POST is `{user_id,org_unit_id}`.
  Blank skips assignment; failure reports created-but-unassigned without rollback.
- Edit (`UsersEdit` / `useUserForm`): loaded metadata/spec retained, name disabled, source email disabled with a hint.
  Hidden placeholder email is resent unchanged; no password or department field.
- Edit payload mechanics: `src/foundation/contract.md`, “Edit PATCH”.
- Delete mechanics: `src/foundation/contract.md`, “Soft delete and force”. `validateUserProfileDeletion` refuses
  direct role assignments with 10130; force does not bypass it. `125` policies protect self and name `admin`.
- Deletion controller: `UserProfileController.sync` deletes GoTrue first; errors become Failed unless forced;
  then marks Deleted and removes the profile on the next reconcile. Missing GoTrue users count as success.
- YAML: `src/foundation/contract.md`, “YAML import and export”; no User export option or dedicated import.

## Descriptions

- Email has native `type="email"` validation; name/email placeholders use `user_profiles.placeholders.*`.
- Password minimum six (`user_profiles.validation.passwordMinLength`); no required rule on password itself.
  Confirmation is required and must match (`pages.auth.errors.confirmPasswordRequired|confirmPasswordNotMatch`).
- External email: `user_profiles.hints.externalEmail`; hidden email placeholder is `EMPTY_VALUE`.
- Department is optional; `OrgUnitField` supplies active readable departments.

## Overrides

- Source labels lock email for any nonempty source, not just LDAP/OIDC; backend `108` uses the same condition.
- Placeholder masking changes only the displayed value (`useUserForm` comment): an absent or
  changed email in the full spec would be refused for an external profile.
- Department assignment is separate and needs a global grant (`UsersCreate` backend-constraint comments): a new user
  belongs to no subtree yet. Failure leaves the successfully created user available for later assignment.

## Password and source trace

`UserProfile` has no `api:"-"` fields; password is absent from `UserProfileSpec` and every profile PATCH.
`createUser` passes password to `AdminCreateUser`; `CreateUserResponse` returns `{id,email,username}` only.
Untouched edit sends the loaded record with `spec:{email:"alice@example.org"}` and no password key.
Local email replacement/clear sends `spec:{email:"new@example.org"}` or `spec:{email:""}`.
Hidden external email sends `spec:{email:"id@corp.oidc.neutree.local"}`.
Untouched null email sends `spec:{email:null}`.

`api.apply_user_profile_identity_source` (`108`) accepts unchanged external email and recomputes source labels
from auth metadata. `public.user_profile_email` (`107`) prefers directory email, else the auth placeholder.
`UserProfileController.syncSpecToGoTrue` skips LDAP/OIDC email updates (`auth.ManagesField`); local email changes
reach `AdminUpdateUser`. `auth.UpdateExternalUser` refreshes source display name/email during login or sync.
`auth.ExternallyManagedFields` (`internal/auth/identity_source.go`) and `handleUpdateUser` protect LDAP/OIDC
email/password/phone. These pages offer no password edit for any source.
Unlabeled SSO follows local rules; labeled OIDC follows external rules.

Department writes are valid for new local users: `api.org_unit_members_before_write` (`120`) allows an omitted
`identity_source` only without an external identity link and rejects inactive targets (10277).
Detail `UserDepartmentSection` delegates source locking to `orgUnitAssignmentMode`; memberships are separate records.

## Error mapping

Profile failures: `src/foundation/contract.md`, “Error toast path”. No User field mapping.
Auth JSON `error` becomes provider code 20001; name/email/password requirements surface through this toast path.
Profile codes: 10001/10003/10004 name, 10265 rename, 10260 external email; deletion 10130; permission failures.
Department creation catches membership errors separately, translates `ORGANIZATION_ERROR_KEYS` or unknown fallback,
and reports partial success.

## Known deviations

1. Local display names are shown but cannot be edited.
   UI: `src/domains/user/hooks/use-user-form.tsx:useUserForm` exposes only name/email on edit.
   API: `v1.Metadata.DisplayName` (`api/v1/basic_types.go`) is writable and preserved by
   `update_metadata_update_timestamp_column` (`019_annotations`). Users cannot change a local human name here.
   Ticket: TBD
2. Missing or invalid names and missing emails have no client field error.
   UI: `src/domains/user/hooks/use-user-form.tsx:useUserForm` has no name/email required or name-pattern rule.
   API: `CreateUserRequest` requires email, `createUser` requires username, and
   `api.validate_metadata_name` (`004_required_fields`) rejects invalid names. Users can submit incomplete data
   and receive a generic creation toast instead of a field error. Ticket: TBD
3. Email synchronization failures are not visible on the User pages.
   UI: `src/pages/users/list.tsx:UsersList` and `src/pages/users/show.tsx:UsersShow` never render status.
   API: `UserProfileController.sync` (`controllers/user_profile_controller.go`) records Failed and an error
   when `syncSpecToGoTrue` fails.
   Users see the saved email while login can still use the old email, without seeing the failure.
   Ticket: TBD

## Open points

No live GoTrue/PostgREST or concurrent edit was run. Empty/null email is pinned at submit; auth acceptance is untested.
