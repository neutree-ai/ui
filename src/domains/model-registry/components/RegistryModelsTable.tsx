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
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import Timestamp from "@/foundation/components/Timestamp";
import { useRegistryModels } from "@/foundation/hooks/use-registry-models";
import { useTranslation } from "@/foundation/lib/i18n";
import type { RegistryModelVersion } from "@/foundation/types/model-types";

/**
 * The models of one registry, paged against the server.
 *
 * The listing is deliberately cheap: it carries a model's name, versions, size
 * and alias, and nothing the server would have to open a checkpoint to answer.
 * The parsed shape of a model lives on its detail page — fetching it for every
 * row here would turn one listing into a page-load's worth of checkpoint reads.
 */

const PAGE_SIZE = 20;

type Row = {
  model: string;
  version: RegistryModelVersion;
};

const rowKey = (row: Row) => `${row.model}:${row.version.name}`;

type Props = {
  workspace: string;
  registry: string;
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const { models, total, isLoading, isFetching, error } = useRegistryModels({
    workspace,
    registry,
    search: debouncedSearch || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const rows: Row[] = models.flatMap((model) =>
    model.versions.map((version) => ({ model: model.name, version })),
  );

  // A short page is the end of the listing. When the registry cannot report a
  // total this is the only end-of-list signal there is.
  const hasNextPage =
    total === null ? models.length >= PAGE_SIZE : offset + PAGE_SIZE < total;

  const body = () => {
    if (error) {
      return (
        <TableRow>
          <TableCell colSpan={5}>
            <EmptyState variant="inline" data-testid="registry-models-error">
              <span className="text-destructive">{error.message}</span>
            </EmptyState>
          </TableCell>
        </TableRow>
      );
    }

    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={5}>
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
      return (
        <TableRow>
          <TableCell colSpan={5}>
            <EmptyState variant="inline" data-testid="registry-models-empty">
              {t("model_registries.models.empty")}
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
          <Timestamp timestamp={row.version.creation_time} />
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="space-y-3" data-testid="registry-models-table">
      <div className="flex items-center gap-2">
        <Input
          className="max-w-xs"
          value={search}
          placeholder={t("model_registries.models.searchPlaceholder")}
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

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {/* Before a page arrives there is nothing to say about the total.
              "Unknown" is a statement about the registry — that it cannot count
              what matched — and it must not be made while still asking. */}
          {isLoading || error
            ? null
            : total === null
              ? t("model_registries.models.totalUnknown")
              : t("table.pagination.totalItems", { total })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
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
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            <span className="sr-only">
              {t("table.pagination.goToNextPage")}
            </span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
