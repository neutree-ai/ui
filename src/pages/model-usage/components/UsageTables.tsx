import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiKeyLabel } from "@/domains/api-key/components/ApiKeyLabel";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { MetricBar } from "@/foundation/components/MetricBar";
import { PaginationControls } from "@/foundation/components/PaginationControls";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokens } from "@/foundation/lib/unit";
import { formatTick } from "@/pages/model-usage/components/UsageChart";
import type { UsageFact } from "@/pages/model-usage/lib/usage-scope";
import {
  formatShare,
  shareOf,
  type UsageSeries,
} from "@/pages/model-usage/lib/usage-series";

// Rows per page. The breakdowns are a glanceable ranking, so they page at 10;
// the per-record table is where people hunt for a specific request, so it
// shows 50.
const CARD_PAGE_SIZE = 10;
const DETAIL_PAGE_SIZE = 50;

// The tables share one reset rule: back to page 1 when the scope changes,
// never when the 60s poll refreshes the rows.
function usePagedRows<T>(rows: T[], resetKey: string, pageSize: number) {
  // Deriving the page from the scope key instead of resetting it in an effect:
  // the scope changed on the last render means we are back on page 1, and no
  // effect has to fire (or fight) the interaction that changed the scope.
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const page = state.key === resetKey ? state.page : 1;
  const setPage = (next: number) => setState({ key: resetKey, page: next });
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  return {
    page: currentPage,
    pageCount,
    setPage,
    pagedRows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
  };
}

const TablePager = ({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) => {
  const { t } = useTranslation();
  if (pageCount <= 1) return null;
  return (
    <div className="border-t border-[var(--nt-stroke-neutral-trans-2)] px-4 py-2">
      <PaginationControls
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        showPageSize={false}
        summary={t("table.pagination.totalItems", { total })}
      />
    </div>
  );
};

const EmptyRow = ({ colSpan }: { colSpan: number }) => {
  const { t } = useTranslation();
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="py-8 text-center text-muted-foreground"
      >
        {t("model_usage.empty")}
      </TableCell>
    </TableRow>
  );
};

/**
 * Usage per entry — department, user, Team, API key or model — with each
 * entry's share of `total`. Pass `total` null when entries overlap, as Teams
 * do, so no share is shown that would not add up. An entry with a `target`
 * opens it through `onOpen`.
 */
export function UsageTable<T>({
  nameHeader,
  rows,
  resetKey,
  total,
  showRequests = false,
  onOpen,
}: {
  nameHeader: string;
  rows: (UsageSeries & { target?: T | null })[];
  resetKey: string;
  total: number | null;
  showRequests?: boolean;
  onOpen?: (target: T) => void;
}) {
  const { t } = useTranslation();
  const { page, pageCount, setPage, pagedRows } = usePagedRows(
    rows,
    resetKey,
    CARD_PAGE_SIZE,
  );
  const columns = 4 + (showRequests ? 1 : 0) + (total === null ? 0 : 1);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{nameHeader}</TableHead>
            {showRequests ? (
              <TableHead className="w-[110px] text-right">
                {t("model_usage.group.requests")}
              </TableHead>
            ) : null}
            <TableHead className="w-[130px] text-right">
              {t("model_usage.promptTokens")}
            </TableHead>
            <TableHead className="w-[130px] text-right">
              {t("model_usage.completionTokens")}
            </TableHead>
            <TableHead className="w-[130px] text-right">
              {t("model_usage.totalTokens")}
            </TableHead>
            {total === null ? null : (
              <TableHead className="w-[150px]">
                {t("model_usage.share")}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={columns} />
          ) : (
            pagedRows.map((r) => {
              const { target } = r;
              return (
                <TableRow key={r.key}>
                  <TableCell className="max-w-[240px]">
                    {onOpen && target ? (
                      <button
                        type="button"
                        className="group flex max-w-full items-center gap-1 text-left text-primary hover:underline"
                        onClick={() => onOpen(target)}
                      >
                        <ApiKeyLabel
                          name={r.name}
                          description={r.description}
                        />
                        <ChevronRight className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                      </button>
                    ) : (
                      <ApiKeyLabel name={r.name} description={r.description} />
                    )}
                  </TableCell>
                  {showRequests ? (
                    <TableCell className="text-right font-mono text-xs">
                      {(r.requests ?? 0).toLocaleString()}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right font-mono text-xs">
                    {formatTokens(r.prompt)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatTokens(r.completion)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">
                    {formatTokens(r.total)}
                  </TableCell>
                  {total === null ? null : (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MetricBar
                          className="w-16"
                          size="sm"
                          shape="rounded"
                          value={shareOf(r.total, total)}
                        />
                        <span className="font-mono text-xs">
                          {formatShare(r.total, total)}
                        </span>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      <TablePager
        page={page}
        pageCount={pageCount}
        pageSize={CARD_PAGE_SIZE}
        total={rows.length}
        onPageChange={setPage}
      />
    </>
  );
}

/**
 * The per-record breakdown: date, who used it (a user or an API key),
 * endpoint type, endpoint, model and tokens.
 */
export function DetailTable({
  rows,
  resetKey,
  whoHeader,
}: {
  rows: UsageFact[];
  resetKey: string;
  whoHeader: string;
}) {
  const { t } = useTranslation();
  const { page, pageCount, setPage, pagedRows } = usePagedRows(
    rows,
    resetKey,
    DETAIL_PAGE_SIZE,
  );
  const showRequests = rows.some((r) => r.requests !== undefined);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">
              {t("model_usage.detail.date")}
            </TableHead>
            <TableHead className="w-[160px]">{whoHeader}</TableHead>
            <TableHead className="w-[110px]">
              {t("model_usage.detail.endpointType")}
            </TableHead>
            <TableHead>{t("model_usage.detail.endpoint")}</TableHead>
            <TableHead>{t("model_usage.model")}</TableHead>
            {showRequests ? (
              <TableHead className="text-right">
                {t("model_usage.group.requests")}
              </TableHead>
            ) : null}
            <TableHead className="text-right">
              {t("model_usage.promptTokens")}
            </TableHead>
            <TableHead className="text-right">
              {t("model_usage.completionTokens")}
            </TableHead>
            <TableHead className="text-right">
              {t("model_usage.totalTokens")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={showRequests ? 9 : 8} />
          ) : (
            pagedRows.map((r, i) => (
              <TableRow
                key={`${r.date}-${r.who.key}-${r.endpoint_name}-${r.model_name}-${i}`}
              >
                <TableCell className="font-mono text-xs">
                  {formatTick(r.date)}
                </TableCell>
                <TableCell className="max-w-[160px] text-sm">
                  <ApiKeyLabel
                    name={r.who.name}
                    description={r.who.description}
                  />
                </TableCell>
                <TableCell>
                  <EndpointTypeBadge type={r.endpoint_type} />
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {r.endpoint_name || <EmptyValue />}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {r.model_name || <EmptyValue />}
                </TableCell>
                {showRequests ? (
                  <TableCell className="text-right font-mono text-xs">
                    {(r.requests ?? 0).toLocaleString()}
                  </TableCell>
                ) : null}
                <TableCell className="text-right font-mono text-xs">
                  {formatTokens(r.prompt_tokens ?? 0)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatTokens(r.completion_tokens ?? 0)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-medium">
                  {formatTokens(r.usage ?? 0)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <TablePager
        page={page}
        pageCount={pageCount}
        pageSize={DETAIL_PAGE_SIZE}
        total={rows.length}
        onPageChange={setPage}
      />
    </>
  );
}

const EndpointTypeBadge = ({ type }: { type: string | null }) => {
  const { t } = useTranslation();
  if (type === "external-endpoint") {
    return <Badge variant="outline">{t("model_usage.detail.external")}</Badge>;
  }
  if (type === "endpoint") {
    return (
      <Badge variant="secondary">{t("model_usage.detail.internal")}</Badge>
    );
  }
  return <EmptyValue />;
};
