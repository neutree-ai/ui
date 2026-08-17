import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  registryIsDisabled,
  registryIsUnreachable,
} from "@/domains/model-registry/lib/capabilities";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import Timestamp, { formatTimestamp } from "@/foundation/components/Timestamp";
import { useRegistryModels } from "@/foundation/hooks/use-registry-models";
import { useTranslation } from "@/foundation/lib/i18n";
import { registryPagesFromOffset } from "@/foundation/lib/model-registry-visibility";
import type { RegistryModelVersion } from "@/foundation/types/model-types";

/**
 * The models of one registry, paged against the server.
 *
 * The listing is deliberately cheap: it carries a model's name, versions, size
 * and alias, and nothing the server would have to open a checkpoint to answer.
 * The parsed shape of a model lives on its detail page — fetching it for every
 * row here would turn one listing into a page-load's worth of checkpoint reads.
 *
 * ## Paging follows what the registry can do
 *
 * Two registries answer this route with different capabilities, and the controls
 * say which one is in front of you rather than offering both and failing:
 *
 * - **it counted the matches** (`Content-Range: 0-19/57`) — the server holds the
 *   whole result set, so it can be asked to start at row N. Numbered paging,
 *   with the total.
 * - **it could not** (`Content-Range: 0-19/*`) — the server is relaying a
 *   catalogue it does not hold, and refuses `offset > 0` outright. There is no
 *   total to show and no next page to offer; what it *will* do is answer a
 *   bigger `limit`, so "show more" widens the window instead. The count is shown
 *   as unknown, because inventing one from the rows on screen would be a lie
 *   that gets worse the more pages there are.
 *
 * Neither branch mentions a provider. The signal is the range header, and a
 * refusal names itself (`reason: "not_supported"`), so a registry that starts
 * answering differently — or a second provider that answers differently from the
 * first — needs nothing changed here.
 *
 * `canPageForward` below is the judgement "can this be paged forward at all";
 * the second branch is what gets offered when the answer is no. One fact, two
 * consequences.
 */

const PAGE_SIZE = 20;

/**
 * How far "show more" will widen a listing that cannot be paged from an offset.
 *
 * There has to be a stop somewhere: each widening re-requests the whole window,
 * and a catalogue with no total has no end to walk to. Past this the honest
 * answer is that the listing is not the way to find a specific model, and the
 * search box is — which the UI says rather than quietly capping.
 */
const MAX_WINDOW = PAGE_SIZE * 10;

type Row = {
  model: string;
  version: RegistryModelVersion;
};

const rowKey = (row: Row) => `${row.model}:${row.version.name}`;

/**
 * Whether there is a next page to ask for.
 *
 * A registry that cannot say how many models matched is a registry that cannot
 * be read from an offset either — both come from the same limitation in the
 * upstream API, so an unknown total is the fact to read here. Offering a next
 * page in that case promises something the server answers with a 400; a short
 * page is not evidence either way, because such a registry has no last page to
 * reach.
 *
 * This asks the server's own answer, not which provider is behind the registry:
 * nothing in this file knows or should know that.
 */
export const canPageForward = (
  total: number | null,
  offset: number,
  pageSize: number = PAGE_SIZE,
) => (total === null ? false : offset + pageSize < total);

const COLUMN_COUNT = 5;

type Props = {
  workspace: string;
  registry: ModelRegistry;
  /** Builds the link to a model's detail page. */
  modelHref: (model: string, version: string) => string;
};

export const RegistryModelsTable = ({
  workspace,
  registry,
  modelHref,
}: Props) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [windowSize, setWindowSize] = useState(PAGE_SIZE);
  const [offsetRefused, setOffsetRefused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Reset with the search that actually changed, not with the keystroke: a
  // debounce timer still in flight from mount would otherwise undo a "show more"
  // clicked inside the first 300ms.
  useEffect(() => {
    setOffset(0);
    setWindowSize(PAGE_SIZE);
  }, [debouncedSearch]);

  // Nothing can be listed from a registry that is not answering. The reason and
  // the retry live in the notice above this table; asking anyway would add a
  // 500 and a red error to a page that has already explained itself, which is
  // exactly the noise an air-gapped install should not have to look at.
  const unreachable = registryIsUnreachable(registry);
  const disabled = registryIsDisabled(registry);

  const { page, models, total, isLoading, isFetching, error } =
    useRegistryModels({
      workspace,
      registry: registry.metadata.name,
      search: debouncedSearch || undefined,
      limit: windowSize,
      offset,
      enabled: !unreachable && !disabled,
      // Paging is the case this exists for: without it the table empties itself
      // on every page change and the rows jump back in a moment later.
      keepPreviousData: true,
    });

  // The server names this refusal, so a registry that turns out not to page can
  // have the control taken away from it rather than left there to fail again.
  useEffect(() => {
    if (error?.reason === "not_supported" && offset > 0) {
      setOffsetRefused(true);
      setOffset(0);
    }
  }, [error, offset]);

  // Two questions, both answered from `total` and neither from the provider:
  //
  //   registryPagesFromOffset — *can* this registry be read from an offset at
  //     all, i.e. did it count what matched? This picks which control to show.
  //   canPageForward — *is there* a next page to go to right now? This enables
  //     that control once there is one.
  //
  // They are not duplicates, and they disagree exactly where it matters: at the
  // end of a counted listing the first is still true (paging works fine) while
  // the second is false (nothing further to reach). That is a disabled Next, not
  // a switch to "show more".
  //
  // Explicitly `=== true`: the capability is unknown until a page arrives, and
  // "unknown" must not be read as "yes".
  const pagesFromOffset =
    !offsetRefused && registryPagesFromOffset(page) === true;

  const rows: Row[] = models.flatMap((model) =>
    model.versions.map((version) => ({ model: model.name, version })),
  );

  const hasNextPage = canPageForward(total, offset, windowSize);
  // Widening is a different action from paging, so it needs its own end signal:
  // `canPageForward` says false for an uncountable registry on purpose — paging
  // really is impossible there — while a short page is the only end-of-list
  // evidence such a registry ever gives.
  //
  // Read from the page **in hand**, against the limit *it* was fetched with, and
  // never against `windowSize`. With `keepPreviousData` the two disagree for the
  // whole flight of a "show more" — 20 rows held over while 40 is being asked
  // for — and comparing them would announce "end of the listing" during every
  // widening, then keep announcing it if that request failed: a retryable error
  // dressed up as a settled fact. Null while no page has arrived, so nothing is
  // claimed before there is something to claim it about.
  const arrivedWindowIsFull =
    page === null || page.limit === null
      ? null
      : page.models.length >= page.limit;
  const canWiden = arrivedWindowIsFull === true && windowSize < MAX_WINDOW;

  const freshness = page?.freshness;

  const body = () => {
    if (disabled) {
      return (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT}>
            <EmptyState variant="inline" data-testid="registry-models-disabled">
              {t("model_registries.models.registryDisabled")}
            </EmptyState>
          </TableCell>
        </TableRow>
      );
    }

    if (unreachable) {
      return (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT}>
            <EmptyState
              variant="inline"
              data-testid="registry-models-unreachable"
            >
              {t("model_registries.models.registryUnreachable")}
            </EmptyState>
          </TableCell>
        </TableRow>
      );
    }

    if (error) {
      // Reported in the server's own words and in a neutral tone: every failure
      // this route has is the registry declining to answer — no route out, a
      // token wanted, a hub rate-limiting us — which is a condition to read, not
      // damage to alarm about.
      return (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT}>
            <EmptyState variant="inline" data-testid="registry-models-error">
              {error.message}
            </EmptyState>
          </TableCell>
        </TableRow>
      );
    }

    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT}>
            <div
              className="flex justify-center py-6"
              data-testid="registry-models-loading"
            >
              <Loader className="h-4 text-primary" />
            </div>
          </TableCell>
        </TableRow>
      );
    }

    if (rows.length === 0) {
      // "Nothing matched what you typed" and "there is nothing here" send people
      // in opposite directions, so they are not the same sentence.
      return (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT}>
            <EmptyState
              variant="inline"
              data-testid={
                debouncedSearch
                  ? "registry-models-no-matches"
                  : "registry-models-empty"
              }
            >
              {debouncedSearch
                ? t("model_registries.models.noMatches", {
                    search: debouncedSearch,
                  })
                : t("model_registries.models.empty")}
            </EmptyState>
          </TableCell>
        </TableRow>
      );
    }

    return rows.map((row) => (
      <TableRow key={rowKey(row)}>
        <TableCell>
          <Link
            to={modelHref(row.model, row.version.name)}
            className="text-primary hover:underline"
          >
            {row.model}
          </Link>
        </TableCell>
        <TableCell>
          {row.version.alias || (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>{row.version.name}</TableCell>
        <TableCell>
          {row.version.size || (
            <span className="text-muted-foreground">
              {t("model_registries.models.values.unknown")}
            </span>
          )}
        </TableCell>
        <TableCell>
          {/* Empty, not absent, when the registry does not know — see the same
              treatment on the detail page. */}
          {row.version.creation_time ? (
            <Timestamp timestamp={row.version.creation_time} />
          ) : (
            <span className="text-muted-foreground">
              {t("model_registries.models.values.unknown")}
            </span>
          )}
        </TableCell>
      </TableRow>
    ));
  };

  const countLine = () => {
    // Before a page arrives there is nothing to say about the total. "Unknown"
    // is a statement about the registry — that it cannot count what matched —
    // and it must not be made while still asking.
    if (isLoading || error || disabled || unreachable) {
      return null;
    }

    if (total === null) {
      return t("model_registries.models.totalUnknown");
    }

    return t("table.pagination.totalItems", { total });
  };

  const pager = () => {
    if (disabled || unreachable) {
      return null;
    }

    // A failed request says nothing about where the listing ends. The body
    // reports it; this half stays quiet rather than concluding anything.
    if (error) {
      return null;
    }

    if (pagesFromOffset) {
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - windowSize))}
            data-testid="registry-models-prev"
          >
            <span className="sr-only">
              {t("table.pagination.goToPreviousPage")}
            </span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={!hasNextPage}
            onClick={() => setOffset(offset + windowSize)}
            data-testid="registry-models-next"
          >
            <span className="sr-only">
              {t("table.pagination.goToNextPage")}
            </span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    // The registry cannot be asked to start at row N, so there is no next page
    // to go to — only a wider first one. Both statements need a page to have
    // arrived first.
    if (rows.length === 0 || arrivedWindowIsFull === null) {
      return null;
    }

    return (
      <div className="flex items-center gap-2">
        {canWiden ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => setWindowSize(windowSize + PAGE_SIZE)}
            data-testid="registry-models-show-more"
          >
            {t("model_registries.models.showMore")}
          </Button>
        ) : (
          <span
            className="text-sm text-muted-foreground"
            data-testid="registry-models-window-end"
          >
            {arrivedWindowIsFull
              ? t("model_registries.models.windowCapped", {
                  count: windowSize,
                })
              : t("model_registries.models.listingEnd")}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3" data-testid="registry-models-table">
      <div className="flex items-center gap-2">
        <Input
          className="max-w-xs"
          value={search}
          placeholder={t("model_registries.models.searchPlaceholder")}
          disabled={unreachable || disabled}
          onChange={(event) => setSearch(event.target.value)}
          data-testid="registry-models-search"
        />
        {isFetching ? <Loader className="h-4 text-muted-foreground" /> : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.fields.name")}</TableHead>
            <TableHead>{t("model_registries.models.fields.alias")}</TableHead>
            <TableHead>{t("common.fields.version")}</TableHead>
            <TableHead>{t("model_registries.models.fields.size")}</TableHead>
            <TableHead>{t("common.fields.createdAt")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{body()}</TableBody>
      </Table>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5 text-sm text-muted-foreground">
          <div>{countLine()}</div>
          {/* How old the rows are, as the server stated it. Not measured here:
              a clock in the browser would be timing when the answer arrived,
              which is not when the registry was read. */}
          {freshness?.timestamp && (
            <div className="text-xs" data-testid="registry-models-data-age">
              {freshness.cached
                ? t("model_registries.models.dataAsOfCached", {
                    time: formatTimestamp(freshness.timestamp),
                  })
                : t("model_registries.models.dataAsOf", {
                    time: formatTimestamp(freshness.timestamp),
                  })}
            </div>
          )}
        </div>
        {pager()}
      </div>
    </div>
  );
};
