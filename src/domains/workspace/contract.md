# Workspace contract

Backend: `v1.Workspace`, `WorkspaceStatus` (`api/v1/workspace_types.go`); `api.workspaces`,
`api.workspace_status` (`001_rbac`). `RegisterWorkspaceRoutes`
(`internal/routes/proxies/workspace_proxy.go`): GET/POST/PATCH `/api/v1/workspaces`; no Workspace RPC.
Permissions: `workspace:read|create|update|delete` (`001_rbac`, `022_soft_delete_permission`).
Read/physical delete check name, create checks global rights, update checks `metadata.workspace` (normally null).
Global Refine resource `workspaces`, key `metadata->name` (`src/App.tsx`). Backend: `origin/main@062192f6`.

## Type

UI: `src/domains/workspace/types.ts`. No spec or per-workspace quota object.
`v1.Workspace`, `WorkspaceStatus` and `v1.Metadata` have no masked fields or secret inputs.
Edit below describes the form hook; no edit route is mounted.

| path | type | required/default | owner | secret | edit | backend rule |
|---|---|---|---|---|---|---|
| `id` | integer | serial | server | no | no | primary key |
| `api_version`, `kind` | strings | v1, Workspace | user | no | no UI | NOT NULL headers |
| `metadata.name` | string | required; form blank | user | no | locked | name validator; global unique index |
| `metadata.workspace` | string/null | absent on create | user | no | no UI | global resource metadata |
| `metadata.display_name` | string/null | absent | user | no | no UI | `Metadata.DisplayName` |
| `metadata.labels`, `.annotations` | string maps | absent | user | no | no UI | `Metadata` |
| `metadata.creation_timestamp`, `.update_timestamp` | timestamps | current time | server | no | no | timestamp triggers in 019 |
| `metadata.deletion_timestamp` | timestamp/null | absent | user | no | delete | default protection in 040 |
| `status.phase` | Pending/Created/Deleted | absent | server | no | no | `WorkspaceController.sync` |
| `status.service_url` | string | absent | server | no | no | `WorkspaceStatus.ServiceURL` |
| `status.error_message`, `.last_transition_time` | text/time | absent | server | no | no | `WorkspaceController.updateStatus` |

`api.validate_metadata_name` (`004_required_fields`) rejects empty/null names (10001), invalid lowercase
DNS-style names allowing dots (10003), and names over 63 characters (10004).
`workspaces_name_unique_idx` includes deleting rows.
Timestamp functions in `019_annotations` retain human names and maps. The UI type omits status;
loaded values retain it at runtime.

## Roles

- Name and created columns: `useMetadataColumns`; technical names identify and label workspaces.
- Time: relative `Timestamp` in the list, `MetadataTimestampMeta` on show.
- Current selection and workspace inputs: `src/foundation/contract.md`, “Workspace selection”.
- No status, unit or secret role is used.

## Scenes

- List (`src/pages/workspaces/list.tsx:WorkspacesList`): name, created, actions; server name search through
  `WORKSPACE_NAME_FIELD`, newest-created `defaultSorters`, sorting/filters and batch delete. Row action: delete.
- Show (`src/pages/workspaces/show.tsx:WorkspacesShow`): technical name and timestamps; no edit action.
  Assignment table filters `spec->workspace` by the JSON-quoted workspace name and shows name, role, subject, created.
- Subject labels use `RoleAssignmentSubjectLabel`, `TeamLabel`, `OrgUnitLabel`;
  assignment behavior: `src/domains/role-assignment/contract.md`. Missing records show `pages.error.notFound`.
- Create (`WorkspacesCreate`, `hooks/use-workspace-form.tsx:useWorkspaceForm`): name only, `mode:"all"`,
  unsaved warning. Submit sends `{api_version:"v1",kind:"Workspace",metadata:{name}}` without trimming.
- Edit: `useWorkspaceForm({action:"edit"})` locks name and retains the loaded record; there is no submit transform.
  `src/App.tsx` declares an edit resource URL but mounts only list/show/create routes.
- Edit payload mechanics: `src/foundation/contract.md`, “Edit PATCH”.
- Delete mechanics: `src/foundation/contract.md`, “Soft delete and force”. Workspace has no local resource pre-check
  or protected-name guard; row, batch and show deletion use the backend checks below.
- YAML mechanics: `src/foundation/contract.md`, “YAML import and export”. Workspace is exportable without credentials;
  `kindToResourceType` maps Workspace to workspaces, with no Workspace-specific transform.

## Limits and deletion constraints

`api.validate_workspace_limit` (`021_workspace_limits`) runs before INSERT and counts rows whose
`metadata.deletion_timestamp` is null. One existing live row rejects another with 10042, HTTP 400,
“Workspace limit exceeded”, hint “Only 1 workspace is supported”. A deleting row does not consume this count,
but its name remains reserved by the unique index. No later up migration redefines or drops this trigger/function.

There is no quota field or limit control on these pages. `useLicense.supportMultiWorkspace` reads
`license.status.usage.Workspace.limit` and accepts values above one or `MAX_UNLIMITED` (-1); it does not gate
`WorkspacesList` or `useWorkspaceForm`. Licensed-server overrides are outside the backend tree read here.

Migration 021 also introduced `api.enforce_global_role_assignment`. Its latest definition in
`131_group_role_assignments` still refuses workspace scope (10041), while allowing department and Team scopes.
The show table queries stored workspace-scoped assignments only.

`RegisterWorkspaceRoutes` applies `DeletionValidation` before the PATCH proxy. For a soft-delete body carrying
`metadata.name`, `validateWorkspaceDeletion` counts endpoints, clusters, model registries, image registries,
model catalogs, roles and API keys by `metadata.workspace`, plus assignments by `spec.workspace`.
`postgrestStorage.Count` (`pkg/storage/postgrest.go`) adds no deleted-row filter; those counts include deleting rows.

`userModelRegistryCount` replaces the model-registry count, excluding `v1.IsBuiltin` registries and rows already
marked for deletion. Engines are not counted. External endpoints and log sinks are not checked by this function.
Any positive count returns HTTP 400, code 10125, with resource types/counts in the hint. Force does not bypass it.

`api.prevent_default_workspace_deletion` (`040_limit_delete_default_workspace`) rejects the first transition of
`default` from a null to non-null deletion timestamp with 10043, HTTP 400. It does not inspect force annotations.
The proxy pre-check runs first, so occupied workspaces can return 10125 before SQL.

`WorkspaceController.sync` removes engines through `DeleteWorkspaceEngine` and built-in registries through
`DeleteWorkspaceModelRegistry`, then marks Deleted and physically removes the workspace on the next reconciliation.
Cleanup errors retry without advancing unless forced; force advances with the error in status.

## Descriptions

`useWorkspaceForm`: name label `common.fields.name`, placeholder `workspaces.placeholders.workspaceName`.
No client validation, help or quota input.
`metadata.workspace` is not populated from current selection when creating a Workspace.

## Overrides

- Workspace management is global even though the workspace name scopes other resources; it has no workspace column.
- Technical-name-only presentation and a name-only form have no recorded reason.
- Edit mode is retained in the hook although no edit page is mounted; reason unknown.
- Default and occupied workspaces retain deletion actions; reason unknown.

## Error mapping

Toast mechanics: `src/foundation/contract.md`, “Error toast path”. No local code or field mapping.
Name errors 10001/10003/10004, duplicates, 10042 limit, 10125 resources remaining, 10043 default protection
and permission failures use this path. Deletion hints list types and counts.

## Known deviations

1. Invalid names have no field validation.
   UI: `hooks/use-workspace-form.tsx:useWorkspaceForm` registers name without rules.
   API: `api.validate_metadata_name` (`004_required_fields`) requires a valid name of at most 63 characters.
   Users can submit blank or invalid names and receive a toast instead of a field error. Ticket: TBD
2. Creation remains offered after the backend workspace limit is reached.
   UI: `src/pages/workspaces/list.tsx:WorkspacesList` and `useWorkspaceForm` do not check workspace count or limit.
   API: `api.validate_workspace_limit` (`021_workspace_limits`) refuses another live workspace with 10042.
   Users can fill a new Workspace form that cannot be saved on the traced backend. Ticket: TBD
3. Default workspace deletion remains offered.
   UI: `src/pages/workspaces/list.tsx:useWorkspaceColumns` always supplies delete; `WorkspacesShow` allows deletion.
   API: `api.prevent_default_workspace_deletion` (`040_limit_delete_default_workspace`) protects default with 10043.
   Users can confirm deletion, including force deletion, and receive a refusal toast. Ticket: TBD
4. Human names are ignored on Workspace surfaces.
   UI: `WorkspacesShow` and `WorkspacesList` use technical names; `useWorkspaceForm` exposes only name.
   API: `v1.Metadata.DisplayName` and `update_metadata_update_timestamp_column` (`019_annotations`) retain human names.
   Users cannot see, search or edit API-supplied human workspace names here. Ticket: TBD
5. Lifecycle and cleanup errors are hidden.
   UI: `WorkspacesList` and `WorkspacesShow` never render status.
   API: `WorkspaceController.updateStatus` writes phase/error details, including forced cleanup failures from `sync`.
   Users cannot inspect those lifecycle details or errors on Workspace pages. Ticket: TBD

## Open points

No live API, licensed override or concurrency was exercised. `api.validate_soft_delete` references `NEW.spec`,
but `api.workspaces` has no spec; the live trigger outcome is unverified. SQL `api.workspace_status` also lacks Go's
`last_transition_time`; its persistence is unverified. Reopen tests reset records because the Refine mock does not
hydrate query data. Tests: `hooks/use-workspace-form.test.tsx`; no browser edit journey exists.
