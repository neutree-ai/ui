import {
  ChevronDown,
  ChevronRight,
  Copy,
  Maximize2,
  Search,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getTypeColorClass } from "@/domains/engine/lib/schema-type-color";
import {
  buildValueSchemaRows,
  formatDefaultValue,
  splitDescriptionJson,
  type ValueSchemaRow,
} from "@/domains/engine/lib/value-schema-rows";
import { EmptyState } from "@/foundation/components/EmptyState";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { SchemaTypeIcon } from "./SchemaTypeIcon";

type ValueSchemaTableProps = {
  schema: unknown;
};

/** Type cell: one icon + label per union branch, arrays keep their item type. */
function TypeCell({ row }: { row: ValueSchemaRow }) {
  const branches = row.types.length > 0 ? row.types : ["unknown"];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {branches.map((branch, index) => (
        <span key={branch} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-muted-foreground">|</span> : null}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs whitespace-nowrap",
              getTypeColorClass(branch),
            )}
          >
            <SchemaTypeIcon type={branch} />
            <span className="text-muted-foreground">
              {branch === "array" && row.itemType
                ? `array<${row.itemType}>`
                : branch}
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

function DefaultCell({ row }: { row: ValueSchemaRow }) {
  const { t } = useTranslation();
  const value = row.hasDefault ? formatDefaultValue(row.defaultValue) : "";
  if (!value) return <span className="text-muted-foreground">-</span>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <code className="block max-w-[180px] truncate font-mono text-xs">
          {value}
        </code>
      </TooltipTrigger>
      <TooltipContent className="max-w-lg break-all font-mono">
        {value}
      </TooltipContent>
    </Tooltip>
  );
}

function DescriptionDialog({ row }: { row: ValueSchemaRow }) {
  const { t } = useTranslation();
  const { copy } = useCopyToClipboard();
  const segments = useMemo(
    () => splitDescriptionJson(row.description),
    [row.description],
  );
  const jsonBlock = segments.find((segment) => segment.kind === "json");

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">{row.path}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {row.types.join(" | ")}
            {row.required ? ` · ${t("engines.schema.required")}` : ""}
          </span>
        </DialogTitle>
      </DialogHeader>
      <div className="max-h-[50vh] space-y-2 overflow-auto text-sm leading-6 text-muted-foreground">
        {segments.map((segment, index) =>
          segment.kind === "json" ? (
            <pre
              key={index}
              className="overflow-auto rounded-md border bg-[var(--nt-fill-neutral-opaque-1)] p-3 font-mono text-xs leading-5 text-foreground"
            >
              {segment.value}
            </pre>
          ) : (
            <p key={index}>{segment.value}</p>
          ),
        )}
      </div>
      {jsonBlock ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              copy(jsonBlock.value, {
                successMessage: t("components.apiKey.copySuccess"),
                errorMessage: t("components.apiKey.errors.copyFailed"),
              })
            }
          >
            <Copy className="size-3.5" />
            {t("engines.schema.copyJson")}
          </Button>
        </div>
      ) : null}
    </DialogContent>
  );
}

function DescriptionCell({ row }: { row: ValueSchemaRow }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const isTruncated = useIsTruncated(ref);

  if (!row.description) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex items-start gap-1.5">
      <div
        ref={ref}
        className="line-clamp-2 min-w-0 flex-1 text-xs leading-5 text-muted-foreground"
      >
        {row.description}
      </div>
      {isTruncated ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-[var(--nt-text-neutral-quaternary)] hover:text-[var(--nt-text-neutral-secondary)]"
              aria-label={t("engines.schema.expandDescription", {
                name: row.path,
              })}
            >
              <Maximize2 className="size-3" />
            </Button>
          </DialogTrigger>
          <DescriptionDialog row={row} />
        </Dialog>
      ) : null}
    </div>
  );
}

export function ValueSchemaTable({ schema }: ValueSchemaTableProps) {
  const { t } = useTranslation();
  const { rows, allowsAdditional } = useMemo(
    () => buildValueSchemaRows(schema),
    [schema],
  );
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = rows.filter((row) =>
      query
        ? row.path.toLowerCase().includes(query) ||
          row.description.toLowerCase().includes(query)
        : true,
    );
    if (!query) {
      return matching.filter((row) => {
        // Hide children whose ancestor is collapsed.
        let parentId = row.parentId;
        while (parentId) {
          if (collapsed.has(parentId)) return false;
          parentId =
            rows.find((candidate) => candidate.id === parentId)?.parentId ??
            null;
        }
        return true;
      });
    }
    // While searching keep the ancestors of a match so paths stay readable.
    const keep = new Set<string>();
    for (const row of matching) {
      keep.add(row.id);
      let parentId = row.parentId;
      while (parentId) {
        keep.add(parentId);
        parentId =
          rows.find((candidate) => candidate.id === parentId)?.parentId ?? null;
      }
    }
    return rows.filter((row) => keep.has(row.id));
  }, [rows, search, collapsed]);

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <EmptyState variant="section">{t("engines.schema.empty")}</EmptyState>
        {allowsAdditional ? (
          <p className="text-xs text-muted-foreground">
            {t("engines.schema.allowsAdditional")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("engines.schema.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {search.trim()
            ? t("engines.schema.filteredCount", {
                visible: visibleRows.length,
                total: rows.length,
              })
            : t("engines.schema.parameterCount", { count: rows.length })}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[26%]">
                {t("engines.schema.columns.parameter")}
              </TableHead>
              <TableHead className="w-[14%]">
                {t("engines.schema.columns.type")}
              </TableHead>
              <TableHead className="w-[14%]">
                {t("engines.schema.columns.default")}
              </TableHead>
              <TableHead>{t("engines.schema.columns.description")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow
                key={row.id}
                data-testid="value-schema-row"
                data-path={row.id}
              >
                <TableCell className="align-top">
                  <span className="flex min-w-0 items-center gap-2">
                    {row.hasChildren ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 text-muted-foreground"
                        aria-expanded={!collapsed.has(row.id)}
                        aria-label={t("engines.schema.toggleNested", {
                          name: row.path,
                        })}
                        onClick={() => toggle(row.id)}
                      >
                        {collapsed.has(row.id) ? (
                          <ChevronRight className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </Button>
                    ) : row.depth > 0 ? (
                      <span className="w-5 shrink-0" />
                    ) : null}
                    <span
                      className={cn(
                        "truncate text-sm",
                        row.title ? "font-medium" : "font-mono text-xs",
                      )}
                      title={row.title ?? row.path}
                    >
                      {row.title ?? row.path}
                    </span>
                    {row.required ? (
                      <span className="inline-flex shrink-0 items-center rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        {t("engines.schema.required")}
                      </span>
                    ) : null}
                  </span>
                  {row.title ? (
                    <span
                      className="block truncate pl-7 font-mono text-xs text-muted-foreground"
                      title={row.path}
                    >
                      {row.path}
                    </span>
                  ) : null}
                  {row.hasChildren && !collapsed.has(row.id) ? (
                    <span className="mt-1 block pl-7 text-xs text-muted-foreground">
                      {t("engines.schema.nestedCount", {
                        count: row.childCount,
                      })}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="align-top">
                  <TypeCell row={row} />
                </TableCell>
                <TableCell className="align-top">
                  <DefaultCell row={row} />
                </TableCell>
                <TableCell className="align-top">
                  <DescriptionCell row={row} />
                  {row.enumValues ? (
                    <span
                      className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md border bg-[var(--nt-fill-neutral-opaque-1)] px-2 py-0.5 text-xs text-muted-foreground"
                      title={row.enumValues.map(String).join(", ")}
                    >
                      {t("engines.schema.enumSummary", {
                        values: row.enumValues
                          .slice(0, 2)
                          .map(String)
                          .join(" · "),
                      })}
                      {row.enumValues.length > 2
                        ? ` +${row.enumValues.length - 2}`
                        : ""}
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {allowsAdditional ? (
        <p className="text-xs text-muted-foreground">
          {t("engines.schema.allowsAdditional")}
        </p>
      ) : null}
    </div>
  );
}
