# AI Traces contract

Backend: `logs.AITrace`, `AITraceListResponse`, `AITraceFilterOptions` (`internal/routes/logs/ai_trace.go`);
`RegisterAITraceRoutes` serves GET `/api/v1/ai-traces/:workspace` plus detail, stats, filter-options and export
routes. `traceStore` (`internal/routes/logs/trace_store.go`) queries VictoriaLogs `/select/logsql/query`;
there is no PostgREST table, view, RPC or resource write. Backend: `origin/main@062192f6`.
Permissions: `endpoint:trace-read` or `external_endpoint:trace-read` (`060`, `061`). `requireTracePermission`
restricts single-permission readers to that type. `resolveAllWorkspacesTraceScope` unions permitted scopes for
`_all_`; global grants include retained traces from deleted workspaces.

## Type

UI: `src/foundation/ai-traces/ai-traces.ts:AITrace`. All fields are server-owned/read-only, without a resource envelope.
Required means serialized, not validated at ingestion. `decodeVLRecord` omits empty strings and preserves zero counts.
No masked fields or secret writes; bodies return as stored.

| path | type | required/default | backend rule |
|---|---|---|---|
| `request_id` | string | required; empty | `decodeVLRecord`; detail lookup key |
| `time` | timestamp string | required; current UTC if missing | VictoriaLogs `_time` |
| `workspace` | string | required; empty | permission scope |
| `endpoint_name`, `endpoint_type` | strings | required; empty | captured endpoint identity |
| `response_status` | integer | required; zero | invalid numeric text becomes zero |
| `stream` | boolean | required; false | stored literal true only |
| `api_key_id` | UUID string | optional | captured key identity |
| `request_uri`, `user_agent` | strings | optional | captured request metadata |
| `request_model`, `response_model` | strings | optional | distinct captured model names |
| `upstream`, `upstream_model` | strings | optional | selected routing target |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | integers | optional | malformed or missing text omitted |
| `duration_ms` | integer milliseconds | optional | float text truncated to integer |
| `finish_reason` | string | optional | captured response value |
| `request_body`, `response_body` | strings | optional; detail only in UI | `traceStore.Get`; chunk reassembly |
| `body_truncated`, `body_incomplete` | booleans | optional; false | absent from UI type; deviation 1 |

`traceStore.baseQuery` excludes internal records; `Get` selects the newest scoped request id without a window.
`reassembleBodies` returns a prefix with body_incomplete for lost chunks; body_truncated marks ingestion truncation.

## Roles

- Time: `Timestamp`, explicit `YYYY-MM-DD HH:mm:ss`, in list and drawer; absolute time.
- Tokens: shared `formatTokens` in list; `TokenSummary` uses browser-locale grouping for each exact count in detail.
  Formatting tests: `src/foundation/role/unit.test.ts`.
- Duration: `list.tsx:formatDuration` divides milliseconds by 1000, two decimals and ` s`; missing uses `EmptyValue`.
- Throughput: `formatThroughput` divides completion tokens by total request seconds, one decimal; header owns tok/s.
  Missing completion tokens or zero/missing duration uses `EmptyValue`; zero tokens with nonzero duration shows 0.0.
- HTTP status: `status.tsx:StatusBadge`, `statusDescription`, `statusShortLabel`; tests in `status.test.ts`.
  Zero shows `EmptyValue`; other codes remain numeric.
- Empty strings and missing counts use `EmptyValue` (`-`); missing endpoint type is blank. Stream shows On or Off.
- App: `userAgentToApp` maps known SDKs/clients, otherwise leading token or first 24 characters.
- Keys: `ApiKeyLabel`, display name or technical name; unresolved list keys show empty, drawer retains UUID.
- Bodies: `parseConversation` / `formatBody` in `TraceDetailDrawer`; presentation tests beside the drawer.

## Scenes

- List (`src/pages/ai-traces/list.tsx:AITracesList`): time, workspace in All, endpoint/type, app, model, routing target,
  HTTP status, key, tokens, throughput, duration, finish reason. Model prefers request then response.
- Query: route workspace enables reads; URL api_key_id initializes once, other filters stay local. Initial range is
  seven local days including today; presets seven/thirty days.
- Paging: `fetchAITraces` sends limit 50 and subsequent `before` from `next_before`; pages are concatenated unchanged.
  No offset, total or client sort. `traceStore.List` always sorts `_time` descending.
- Refresh refetches list and invalidates stats/options. No polling or batch actions.
- Show (`TraceDetailDrawer`): row metadata plus lazily fetched bodies by the row's actual workspace/request id,
  including from All workspaces. Links use technical identities; no standalone show route.
- Stats (`TraceStatsChart`): unfiltered only, same workspace/start/end. `statsWindow` expands to UTC days, caps at
  90 buckets and counts through the following midnight.
- Suggestions: `fetchAITraceFilterOptions` / `handleAITraceFilterOptions` apply workspace/start/end/endpoint_type only;
  options include retained traces.
- Export (`TraceExportButton`): same six filters and time window as list, plus csv/jsonl; no list limit or cursor.
  `handleExportAITraces` exports metadata only, newest first, maximum 100000 rows; CSV includes a UTF-8 BOM.
- Create/Edit/Delete/YAML: no UI or trace write routes. Log forwarding opens Log Sink management; its contract is
  `src/domains/log-sink/contract.md`. No submit transform applies.

## Query contract

`AITraceFilterParams` is shared by list/export. `toSearch` omits undefined/empty strings and URL-encodes values; no
body or sort is sent. `traceListQuery` trims inputs; `traceFilters.clauses` applies exact matches, case-sensitive.

| parameter | page value | server application |
|---|---|---|
| workspace path | route workspace or `_all_` | permission scope from `traceScopeClause` |
| `endpoint_name` | selected or typed full name | exact endpoint_name |
| `endpoint_type` | endpoint or external-endpoint | exact endpoint_type; intersects permission scope |
| `status` | selected numeric string | exact response_status; no status-class expansion |
| `model` | selected or typed full name | exact request_model or response_model |
| `api_key_id` | selected UUID or URL initial value | exact api_key_id |
| `finish_reason` | stop, length, tool_calls, content_filter | exact finish_reason |
| `start`, `end` | local day bounds serialized to UTC ISO | VictoriaLogs start/end parameters |
| `limit` | 50 | integer 1 through 500; otherwise default 50 |
| `before` | previous next_before | replaces end; forwarded without timestamp adjustment |
| `request_id`, `request_model`, `upstream`, `upstream_model` | API helper only; no page input | exact corresponding fields |

`timeWindow.params` forwards bounds without validation. Backend include_body=true is capped at 50 and unused here.
`traceStore.FilterOptions` unions model fields and sorts options. Endpoint picks send only name; type stays separate.

## Descriptions

Labels use `ai_traces.*`; captured names remain untranslated.
`TraceNameFilter` accepts trimmed arbitrary names and offers local case-insensitive substring suggestions.
`parseStatusCode` accepts three digits from 100 through 599 after trimming; backend exact matching has no range check.
Suggestions include gateway 499/504. No other client validation. Failed suggestions leave
free typing available.

## Overrides

- Dedicated cursor table has no offset/total; reason otherwise unknown. Aggregate workspace column disambiguates rows.
- Range presets follow the list comment about thirty-day retention.
- HTTP badges use existing Badge variants rather than STATUS_TONE; substituting it would change presentation.
- Local-day list bounds versus UTC chart buckets: reason unknown; deviation 3.

## Error mapping

`requestError` reads JSON `error`, falls back to statusText and produces `AITraceRequestError` with HTTP status.
`isAITraceForbidden` recognizes its 403; list shows `ai_traces.forbidden` without retries. Other failures retry up to
three times and show the message above the table.
Drawer failures appear inline; export failures use `ai_traces.export.failed` toast plus the error message.
`requireTracePermission`: 401 unauthenticated, 403 forbidden, 500 permission failure. `requireTraceStore`: 503
unconfigured. Store errors: 502; `handleGetAITrace`: 404 absent trace. JSON error strings have no field mapping.

## Known deviations

1. Partial bodies have no warning. UI: `src/foundation/ai-traces/ai-traces.ts:AITrace` omits both body flags and
   `src/pages/ai-traces/components/TraceDetailDrawer.tsx:TraceDetailDrawer` reads only the bodies.
   API: `AITrace.BodyTruncated` and `traceStore.reassembleBodies` expose truncation and missing chunks.
   Users can mistake a retained body prefix for the complete request or response. Ticket: TBD
2. List paging assumes a strictly older cursor. UI: `src/pages/ai-traces/list.tsx:AITracesList` forwards next_before
   and flattens pages without deduplication. API: `traceListQuery` forwards before unchanged as end;
   `tracePager.next` explicitly handles an inclusive boundary, deduplicates and detects a stuck timestamp.
   Users can see repeated boundary rows or repeatedly load the same full timestamp page. Ticket: TBD
3. Chart counts can exceed the list window.
   UI: `src/pages/ai-traces/components/TraceStatsChart.tsx:TraceStatsChart`
   and `src/pages/ai-traces/list.tsx:AITracesList` serialize local-day bounds.
   API: `statsWindow` and `handleAITraceStats` expand those instants to complete UTC days; `traceStore.List` forwards
   the original bounds. Outside UTC, users can see a chart total that includes requests outside the list window.
   Ticket: TBD

## Open points

No live store/ingestion/permission test. Inclusive bounds follow `tracePager.next`; deployed bounds, equal-time
ordering, retention, body redaction and request-id uniqueness at ingestion remain unverified.
