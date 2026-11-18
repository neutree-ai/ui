# Organization contract

Backend: `v1.OrgUnit`, `OrgUnitSpec`, `OrgStatus` (`api/v1/org_unit_types.go`), `v1.Team`, `TeamSpec`
(`api/v1/team_types.go`); `api.org_units`, `api.teams`, `api.org_unit_members`, `api.team_members`
(`120_org_units_and_teams`, `129_manual_teams`). Routes in `internal/routes/proxies/org_proxy.go`:
`RegisterOrgUnitRoutes` GET only; `RegisterTeamRoutes` GET/POST/PATCH/DELETE; membership routes below.
RPCs: `org_unit_subtree_members`, `get_readable_usage_teams`. Backend: `origin/main@062192f6`.
Permissions: `org_unit:read|assign-member`, `team:read|create|update|delete|assign-member` (`119`, `128`, `131`).
OrgUnit reads accept global/subtree grants (`125`); Team reads accept global/Team grants (`131`).
Membership reads follow their group scope. Team create/update/delete stay global (`129`).
Paths below are relative to `src/domains/organization/` unless prefixed. Team has no separate domain.

## Type

`types.ts`; global resources. No masked fields or secret inputs in either kind or membership type.
Defaults distinguish form and database. Edit describes the UI.

| path | type | required/default | owner | edit | backend rule |
|---|---|---|---|---|---|
| `id` | integer | serial | server | no | primary key (`120`) |
| `api_version`, `kind` | strings | v1, OrgUnit/Team | source or user | no UI | NOT NULL |
| `metadata.name` | string | required; form blank | source or user | no | global unique per kind; name validator |
| `metadata.display_name` | string | form blank; stored name fallback | source or user | manual Team | write triggers |
| `metadata.workspace` | string/null | null | server | no | 10270 nonempty |
| `metadata.labels`, `.annotations` | string maps | absent | source or user | project label | `v1.Metadata` |
| `metadata.creation_timestamp`, `.update_timestamp` | timestamps | current time | server | no | timestamp triggers |
| `spec.identity_source`, `.external_id` | strings/null | synced required; manual null | source | no | 10271/10272/10273; pair unique |
| OrgUnit `spec.parent` | OrgUnit name/null | null root | source | no | same-source parent; no cycle |
| OrgUnit `path` | slash-delimited IDs | computed | server | no | `org_units_before_write` |
| `status.phase` | Active/Inactive | Active | source or server | no | `org_object_status`, 10274 |
| `status.last_transition_time` | timestamp | phase-change time | server | no | `org_object_status` |
| OrgUnitMember `user_id` | UUID | required | source or assigner | no | primary key; user foreign key |
| OrgUnitMember `org_unit_id` | integer | required | source or assigner | manual membership | foreign key; 10277 |
| OrgUnitMember `identity_source` | source name/null | null manual | source | no | existing source; nonempty |
| OrgUnitMember `assigned_at` | timestamp | current time | server | no | refreshed on move |
| TeamMember `team_id`, `user_id` | integer, UUID | required | source or assigner | add/remove | composite key; foreign keys |
| TeamMember `created_at` | timestamp | current time | server | no | database default |

`api.validate_metadata_name` (`004_required_fields`): 10001 blank, 10003 lowercase DNS-style name allowing dots,
10004 over 63 characters. `api.org_object_check_identity` (`120`) fixes identity after creation, checks the source
on insert and defaults blank display names. `api.org_units_before_write` trims parent,
computes path and refuses missing/cross-source parents (10275), cycles (10276) and changed IDs (10273).
`api.org_units_after_path_change` repaths descendants; `api.org_units_before_delete` refuses children (10275).

There are no manual OrgUnits: `RegisterOrgUnitRoutes` has no user write method, and table policies have no user writes.
Manual department assignment creates membership in a synced OrgUnit.
`api.teams_before_write` (`129`) normalizes empty source/external ID to null; both null means manual.
Manual Teams are always Active (10291); their names are immutable (10273), and a dash plus 12 lowercase hex digits
is reserved on insert (10288). Synced Teams and their members reject user writes (10289/10290).
`run.applyOrgUnit` / `run.applyTeam` (`internal/identitysync/identitysync.go`) preserve identity across renames and
mark missing directory objects Inactive rather than deleting them.

## Roles

- `displayName` trims the human name and falls back to technical name; `OrgUnitLabel` adds `orgUnitPathLabel`.
  Unreadable groups use trimmed caller fallback or name. Tests: `components/GroupLabels.test.tsx`.
- `lib/org-tree.ts` owns readable ancestry, source grouping, local search/order and Active-first picker order;
  tests beside it. Only explicit Inactive is inactive; `InactiveBadge` supplies its label.
- `teamSource`, `isManualTeam`, `isProjectTeam`, `teamScope`: `lib/team.ts`; tests beside it.
  `TeamSourceLabel` uses the source name or Manual. Project means label `neutree.ai/team-kind: project`.
- `MemberTable`: user, email, optional department/source, time and injected quota; display-name order,
  missing values `EmptyValue`, relative `Timestamp`.
- Member picker: `profileDisplayName`, `profileIdentitySourceName`, `lib/member-tree.ts` (tests beside it).
  Memberships store UUIDs; group pickers store technical names.

## Scenes

- List (`src/pages/organization/list.tsx:OrganizationList`): Departments and Teams tabs gated by readable scope;
  Team-only readers start on Teams. No standalone show/create/edit route, default time sort or batch action.
- Departments (`DepartmentsPanel`): all readable rows, source filter, case-insensitive path search, Inactive hidden;
  detail reads direct members or RPC `{p_org_unit_id}` for subtree members. No department mutation controls.
- Teams (`TeamsPanel`): display-name order; name/human-name search, project/nonproject and Inactive filters; detail
  follows the filtered selection. Synced Team mutations are hidden; scenario actions use scenario wording.
- Usage picker (`useReadableUsageTeams`): POST `{}` to `get_readable_usage_teams` (`136`); returns identity/status
  without spec, under global workspace-usage or readable-Team usage rights.
- URL selections: `useOrganizationView`; tests in `lib/organization-view.test.ts`. Filters stay local.
- Create (`TeamFormDialog`, `useTeamWrites.create`): name/display name trimmed, project false unless scenario preset;
  POST headers are `api_version:"v1"`, `kind:"Team"`; metadata has name/display_name/labels,
  spec is `{identity_source:null,external_id:null}`. Creation resets filters that would hide the new Team.
- Edit (`TeamFormDialog`, `useTeamWrites.update`): prefill from Team; lock name; trim display name; unchanged saves
  disabled. PATCH by numeric id sends only `{metadata}` with the loaded metadata and updated display name/labels.
- Delete (`useTeamWrites.remove`): immediate DELETE by numeric id, no force; members cascade (`120`). The backend
  `api.teams_before_delete` (`131`) checks all live assignment references before all service accounts.
- Pre-check (`src/pages/organization/use-team-delete-check.ts:useTeamDeleteCheck`): global assignment read enables
  Team-subject queries; deleted assignments excluded. Global policy read enables a removable-policy warning.
  Loading or counted assignments disable confirmation; unreadable references do not block locally.
- Member add/remove (`useTeamMemberWrites`): POST array `{team_id,user_id}`; DELETE by both keys, no move/PATCH.
  Picker offers readable local/external users, skips existing members and supports department-subtree filtering.
- `UserDepartmentSection`: external profiles and synced memberships are locked by `orgUnitAssignmentMode`.
  New local assignment needs global assign-member; existing hand assignment accepts any-scope assign-member.
- `useAssignOrgUnit`: POST `{user_id,org_unit_id}`, PATCH `{org_unit_id}` by UUID, DELETE `{}` by UUID.
  `useCreateOrgUnitMembership` supplies the same POST for newly created users. Active department picker stores its ID.
- New-user Teams: `ManualTeamsField` stores technical names, lists only manual Teams/scenarios and needs global
  team:assign-member in `UsersCreate`. `useCreateTeamMemberships` POSTs one `[{team_id,user_id}]` per selection,
  continues after failures and returns `{teamId,cause}` entries. No rollback; empty selections send nothing.
- `UserTeamsSection`: joined Teams with source and Inactive label, display-name order, global Team read required.
- `src/pages/organization/team-detail-tabs.tsx:TeamDetailTabs` embeds accounts/keys, application permissions,
  usage and token pools under their Team permissions; their contracts belong to those domains.
- Transport: `src/foundation/contract.md`, “Row writes”; Team writes invalidate teams/team_members,
  department assignment invalidates org_unit_members/user_profiles.
- YAML: `src/foundation/contract.md`, “YAML import and export”; neither kind has an export option or dedicated import.

## Descriptions

`TeamFormDialog`: name, display name, project mark; descriptions use `organization.teams.*`. `validateTeamName` checks
required, length, shared resource-name pattern and reserved suffix, after trimming. Name errors appear after edited blur
or submit; display name is optional. `AssignOrgUnitDialog`: Active choices; unchanged/absent selection disables save.
`AddTeamMembersDialog`: name/display-name/email search; save requires a new selection. `ManualTeamsField` omits synced
Teams because `api.team_members_before_write` (`131_group_role_assignments`) reserves their membership for directory
sync; `api.team_members_check_grants` (`131`) still checks each new membership.

## Overrides

- Tree and flat-group scenes load unpaged rows; `use-organization.ts` comments cite local tree building and
  frequent label reuse. Reads cache for 60 seconds; membership reads by user do not set that stale time.
- Entire metadata is resent on Team edit because PostgREST replaces composites (kept `useTeamWrites` comment).
  Spec/status are omitted. Clearing display name sends `""`; `api.teams_before_write` (`129`) restores technical name.
- Project is a UI label, not a separate backend kind (`TEAM_KIND_LABEL` comment). Changing it preserves other labels,
  but the reserved label is always removed before optionally writing project; deviation 4.
- Team create/update/delete are global; member assign-member is Team-scoped (`131`; `TeamsPanel` comments).

## Error mapping

Transport decoding: `src/foundation/contract.md`, “Error toast path”. Custom writes suppress automatic notifications.
`ORGANIZATION_ERROR_KEYS` maps codes to inline translated messages, not fields:
10270 workspace; 10271 identity missing; 10272 source missing; 10273 immutable identity; 10274 phase;
10275 parent; 10276 cycle; 10277 inactive target; 10278 external user; 10287 global assigner;
10288 reserved name; 10289/10290 sync ownership; 10291 manual phase; 10295 assignments;
10296 member grant exceeds actor; 10315 applications. Other failures use `translateApiErrorOr`.
`TeamsPanel.errorText`: duplicate create names, denied writes and `TeamWriteNoRowError` get dedicated messages.
Confirm errors are below members; save errors stay in forms. Department errors distinguish current/target scope and
`MembershipOutOfScopeError`.

`api.org_unit_members_before_write` (`127`) requires Active targets and local users for hand assignment;
`api.org_unit_members_check_grants` / `api.team_members_check_grants` (`131`) reject newly inherited grants the actor
cannot create (10296). Department insertion is global-only; updates check old/new scope, deletion old scope (`127`).
`api.teams_before_delete` (`131`) returns 10295 for live Team-subject or Team-scope assignments, then 10315 for any
service account, including disabled ones. Group policies do not block: `api.group_policies_delete_with_group`
(`137_subject_policies`) removes both subject and scoped policies. 10317 is an Active-Team creation guard, not a
Team-delete code: `api.service_accounts_before_write` (`131`) and `api.create_service_account_api_key` (`132`).

## Known deviations

1. Delete pre-check omits Team-scope assignments and service accounts.
   UI: `src/pages/organization/use-team-delete-check.ts:useTeamDeleteCheck` calls only `useGroupRoleAssignments`
   with Team subject and never reads service accounts. API: `api.teams_before_delete` (`131_group_role_assignments`)
   counts subject references, `spec.team` references and every service account (10295/10315).
   Users can confirm a deletion that then fails inline, even with permission to read all references. Ticket: TBD
2. Inactive Teams still offer application and key creation.
   UI: `src/pages/organization/team-detail-tabs.tsx:TeamDetailTabs` gates creation by permission and account disabled
   state, without checking Team phase. API: `api.service_accounts_before_write` (`131`) and
   `api.create_service_account_api_key` (`132_service_account_api_keys`) require Active Team (10317).
   Users can fill creation forms for an Inactive Team and receive a server error on save. Ticket: TBD
3. User detail hides Teams from Team-scoped readers.
   UI: `components/UserOrganization.tsx:UserTeamsSection` requires global `team:read`.
   API: team and member read policies (`131`) accept `api.has_team_scoped_permission` for the specific Team.
   Team administrators cannot inspect readable user memberships there, although Organization can show them. Ticket: TBD
4. Editing a nonproject Team can remove an unfamiliar team-kind label.
   UI: `lib/team.ts:withProjectLabel`, called by `hooks/use-organization.ts:useTeamWrites.update`, drops the reserved
   label even when its value is not project. API: `v1.Metadata.Labels` (`api/v1/basic_types.go`) and
   `api.teams_before_write` (`129_manual_teams`) impose no team-kind enum or normalization.
   Changing only a display name removes an API-supplied alternative team-kind value. Ticket: TBD

## Open points

No live directory, PostgREST or concurrency exercised. Backend conclusions are code traces.
Credential creation belongs to the API-key domain; Organization has no masked-field merge path.
