# Model Usage contract

Backend: SQL rows; no Go resource. `api.get_usage_by_dimension` (`138_usage_by_key_owner`),
`api.get_usage_by_group`, `api.get_readable_usage_teams` (`136_usage_center`). Tables: `api.api_daily_usage`,
`api.group_daily_usage`; no analytics view. POST `/api/v1/rpc/` serves reads.
Backend: `origin/main@062192f6`; migrations below are in `db/migrations/`.
UI paths: `src/pages/model-usage/`; RPC hooks/types: `src/domains/api-key/`.

## Type

`ApiUsageRecord`, `GroupUsageRecord` (`src/domains/api-key/types.ts`): server-owned, read-only, unmasked rows.
`lib/usage-scope.ts:UsageFact` keeps the displayed subset. No secrets or edit payload.

| path | type | required/default | backend rule |
|---|---|---|---|
| `date` | date string | each row | daily bucket |
| `workspace` | string | each row | recorded workspace; legacy fallback unknown |
| `endpoint_type`, `endpoint_name` | string/null | legacy type null | recorded endpoint identity |
| `model_name` | string/null | null for legacy or blank | recorded model |
| `usage` | bigint | each row | total tokens |
| `prompt_tokens`, `completion_tokens` | bigint/null | null for legacy key rows | reported split |
| `cache_read_tokens`, `cache_creation_tokens`, `reasoning_tokens` | bigint/null | null until reported | RPC output only |
| `cost_usd` | numeric/null | null until reported | RPC output only |
| key `api_key_id` | UUID | each key row | live or recorded key |
| key `api_key_name`, `api_key_display_name`, `api_key_description` | string/null | null without live key | current key identity |
| group `kind` | User/Team/OrgUnit/ServiceAccount | requested kind | 22023 for another kind |
| group `name`, `display_name` | string/null | identity and label | UUID for owners; technical name for groups |
| group `requests` | bigint | each group row | aggregated request count |

`group_daily_usage_on_aggregated` (`136`) records department/Active Teams at aggregation time, or an application
and its Team without a user/department. Group reads expand current department ancestry and recorded Teams;
these rows overlap. User rows exclude applications; key output lacks requests.

## Query contract

`lib/usage-scope.ts:scopeQueries` chooses filters; `lib/use-scope-usage.ts:useScopeUsage` combines reads.
`useGroupUsage` / `useWorkspaceUsage` serialize without trimming.

| parameter | page value | server application |
|---|---|---|
| `p_start_date`, `p_end_date` | inclusive YYYY-MM-DD range | DATE bounds with BETWEEN |
| `p_workspace` | route workspace | exact recorded workspace |
| `p_kind` | group reads only | User, ServiceAccount, OrgUnit or Team grouping |
| `p_name` | selected owner UUID | exact group result identity |
| `p_org_unit` | department technical name | recorded department in current subtree |
| `p_team` | Team technical name | recorded Team membership |
| `p_direct` | true for direct department reads | department alone; group RPC also supports unassigned |
| `p_user_id`, `p_service_account_id` | key reads for one owner | current or recorded owner |

All-workspaces `_all_` omits `p_workspace`; empty workspace disables reads. Absent filters and false direct are
omitted. Key reads send direct only with a department. No granularity, timezone, model, sort or page is sent.
Grouping is daily by identity, workspace, endpoint type/name and model; order is date descending, identity/endpoint,
then model for group rows.

| scope | group queries | key filters |
|---|---|---|
| Visible keys, null scope | none | none |
| Platform | all users, applications, departments; unassigned users direct | none |
| Applications | all ServiceAccounts | none |
| Department | subtree users/departments; direct users | department subtree |
| Team | users and applications in Team | Team |
| User | UUID; originating group; department direct | user UUID and same group/direct filter |
| Application | UUID; originating Team if present | account UUID and same group filter |

Team/key reads run only for their tab, except null scope always reads keys. Comparison reads the equal-length
preceding range. Refresh refetches current queries only. The UI filters exact `modelOf` equality; choices/shares keep
all models. It aggregates rankings/series, selects immediate child departments and adds readable idle direct members.

## Permission scope

`ModelUsageList` gates Platform/Applications with `useHasGlobalPermission("workspace:usage-read")` and departments
with `useHasPermission("org_unit:usage-read")`. `useOrgTree` supplies readable departments;
`useReadableUsageTeams` posts `{}` to the picker RPC.

| permission or ownership | server-visible usage | page entry |
|---|---|---|
| global workspace:usage-read | all group and key usage | Platform default |
| workspace-scoped workspace:usage-read | directly readable keys in that workspace | Visible keys |
| org_unit:usage-read | rows recorded under readable departments | first readable root |
| team_usage:read | rows recorded under readable Teams | first Team, then first scenario |
| own personal keys | directly readable key history | Visible keys fallback |
| service_account:read | directly readable application key history | Visible keys fallback |

`get_usage_by_group` (`136`) checks global rights, `can_read_team_usage`, or `readable_usage_org_unit_ids`.
Unassigned direct reads require global rights. `usage_filter_org_unit_ids` / `usage_filter_team_id` resolve names;
unknown departments return no rows, unknown Teams can fail permission.
`get_usage_by_dimension` (`138`) calls `can_read_key_usage` (`136`), which accepts owner or workspace usage rights.
`can_read_api_key_owner_usage` and `can_read_service_account_usage` (`132`) accept self, service-account read or Team
usage read on the account. Unscoped directly readable live keys use full `api_daily_usage` history; group-scoped
reads use group rows only. Other keys expose rows intersecting `readable_usage_team_ids` or
`readable_usage_org_unit_ids`. Deleted keys use recorded owner/workspace rights or those group rights.
Filters only narrow access. `get_readable_usage_teams` (`136`) returns all Teams for global workspace usage rights,
otherwise usage-readable Teams.

## Roles

- Tokens: `formatTokens` (`src/foundation/lib/unit.ts`, tests beside it). Requests: `toLocaleString`.
  No throughput, per-second rate or pricing calculation.
- Shares/change: `formatShare`, `changeOf`, `previousRange`; tests in `lib/usage-series.test.ts`.
  Shares use one decimal or 0% without a denominator; nonpositive previous usage shows no comparison.
- Names: `groupFact` uses `displayName`; `keyFact` prefers display name, then technical name, or a deleted-key
  label with eight UUID characters; `ApiKeyLabel` displays it.
- Null model groups use `EMPTY_VALUE` through `modelOf`; detail missing model/endpoint/type uses `EmptyValue`.
  Null token splits count as zero. `formatTick` shows M/D; range labels use `formatRangeLabel`.
- Empty results use `model_usage.empty` and zero totals; first loading chart uses a loader.
  Comparison errors/placeholders hide change. No status role.

## Scenes

- List (`list.tsx:ModelUsageList`): summary, daily trend, model distribution and breakdown/Team/key/detail tabs.
  Detail: date, identity, endpoint type/name, model, requests when available and token counts. No writes or export.
- Scope panel (`UsageScopePanel`): departments, Teams and scenarios, including Inactive Teams for past usage.
- URL (`readUsageView`, `writeUsageView`): scope, group, owner UUID/label, model, tab, from/to. Reload restores it.
  Absent scope uses the permission default; rejected choices use Visible keys. Tests beside `usage-view.ts`.
- Tables rank descending tokens; details sort descending date then usage. Paging is local, 10 ranking or 50 detail
  rows. Team shares are hidden for overlap. Key shares use the key total; a lower key total gets a coverage warning.

## Descriptions

Labels use `model_usage.*` and `breakdownLabelKeys`; recorded names are untranslated. Default range: 30 local days
including today; presets 7/30/90. URL dates get shape/order checks only. Picking a day sets both bounds.
Owner scopes have key/detail tabs and model series.

## Overrides

- `useScopeUsage` retains the last complete result while parameters change so totals and breakdown never mix scopes
  (hook comment). Disabled queries return no rows; visible-page polling is every 60 seconds.
- Folding/trends: `lib/usage-series.ts`, tests beside it; eight series plus Other bounds chart entries.
- Totals sum users/applications once; department totals exclude applications. Key coverage can be shorter (`136`).

## Error mapping

Transport errors: `src/foundation/contract.md`, “Error toast path”. No local field/code mapping.
`useUsageRpcBatch` clears failed data, disables retry and uses Refine notifications; `ModelUsageList` shows the first
current-query error inline. Identity/comparison failures are excluded. Group errors: 42501 rights, 22023 kind (`136`).

## Known deviations

1. Additional usage dimensions are discarded. UI: `lib/usage-scope.ts:usageFields` drops cache, reasoning and cost;
   API: `api.get_usage_by_dimension` (`138`) and `api.get_usage_by_group` (`136`) return all four.
   Users cannot inspect these reported counts or cost here. Ticket: TBD
2. Legacy usage loses its single-day bar height. UI: `lib/usage-series.ts:aggregateSeries` converts null splits to zero;
   `components/UsageChart.tsx:UsageChart` draws only prompt/completion in day bars. API:
   `api.get_usage_by_dimension.old_dimension_data` (`138`) returns nonzero usage with null splits.
   Users can see a nonzero total without a matching bar for legacy key usage. Ticket: TBD

## Open points

Live API, licensed permissions, RPC row limits and bigint precision are unverified.
Database timezone controls buckets; presets use browser days. Deployment timezone is unverified.
