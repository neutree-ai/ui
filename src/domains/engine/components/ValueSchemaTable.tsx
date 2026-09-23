import { ChevronDown, ChevronRight, Copy, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
  filterValueSchemaRows,
  formatDefaultValue,
  isValueSchemaFilterActive,
  splitDescriptionJson,
  typeBranchLabel,
  type ValueSchemaRow,
  valueSchemaTypeOptions,
} from "@/domains/engine/lib/value-schema-rows";
import { EmptyState } from "@/foundation/components/EmptyState";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import {
  ExpandableCell,
  ExpandPanel,
} from "@/foundation/components/ExpandableCell";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { SchemaTypeIcon } from "./SchemaTypeIcon";

type ValueSchemaTableProps = {
  schema: unknown;
};

/**
 * ShowPage's scroll container carries 4px of top padding, and sticky offsets
 * are measured from its content edge. Both sticky pieces in this table cancel
 * that padding so they meet the container's top edge instead of leaving a
 * sliver of the row behind visible.
 */
const SHOW_PAGE_SCROLL_PADDING = 4;

/**
 * Nested children indent under their parent. The step is capped so a deeply
 * nested schema (imported packages can nest arbitrarily) cannot squeeze the
 * parameter name out of its column. Past the cap the indent alone stops
 * telling two levels apart, so the label switches to `parent.name` — two rows
 * that share an indent are still distinguishable, and the full dotted path
 * stays in the tooltip.
 */
const NESTED_INDENT_STEP = 16;
const MAX_NESTED_INDENT_LEVELS = 3;

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
              {typeBranchLabel(branch, row)}
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

function DefaultCell({ row }: { row: ValueSchemaRow }) {
  const value = row.hasDefault ? formatDefaultValue(row.defaultValue) : "";
  if (!value) return <EmptyValue />;

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

/** Floating panel for one row: the full description plus every enum value.
 *  It renders through a portal, so opening it never changes the row or table
 *  height. */
function RowDetails({ row }: { row: ValueSchemaRow }) {
  const { t } = useTranslation();
  const { copy } = useCopyToClipboard();
  const segments = useMemo(
    () => splitDescriptionJson(row.description),
    [row.description],
  );
  const jsonBlock = segments.find((segment) => segment.kind === "json");

  return (
    <ExpandPanel
      label={row.path}
      meta={
        <span className="text-xs text-muted-foreground">
          {row.types.join(" | ")}
          {row.required ? ` · ${t("engines.schema.required")}` : ""}
        </span>
      }
    >
      <div className="max-h-[40vh] space-y-2 overflow-auto text-xs leading-5 text-muted-foreground">
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

      {row.enumValues ? (
        <div className="space-y-1.5 border-t pt-2.5">
          <div className="text-xs text-muted-foreground">
            {t("engines.schema.enumAll", { count: row.enumValues.length })}
          </div>
          <div className="flex flex-wrap gap-1">
            {row.enumValues.map((value) => (
              <code
                key={String(value)}
                className="rounded-[var(--nt-radius-checkbox)] border px-1.5 py-0.5 font-mono text-xs"
              >
                {String(value)}
              </code>
            ))}
          </div>
        </div>
      ) : null}

      {jsonBlock ? (
        <div className="flex justify-end border-t pt-2.5">
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
    </ExpandPanel>
  );
}

function DetailsCell({ row }: { row: ValueSchemaRow }) {
  const { t } = useTranslation();
  const descriptionRef = useRef<HTMLDivElement>(null);
  const enumRef = useRef<HTMLDivElement>(null);
  const descriptionTruncated = useIsTruncated(descriptionRef);
  const enumTruncated = useIsTruncated(enumRef);
  const needsDetails = descriptionTruncated || enumTruncated;

  return (
    <ExpandableCell
      truncated={needsDetails}
      label={t("engines.schema.expandDescription", { name: row.path })}
      contentClassName="space-y-1"
      panel={<RowDetails row={row} />}
    >
      {row.description ? (
        <div
          ref={descriptionRef}
          className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground"
        >
          {row.description}
        </div>
      ) : (
        // A parameter can legitimately carry no description (nested children
        // of a real engine schema do) — its enum still has to show.
        <EmptyValue />
      )}
      {row.enumValues ? (
        <div
          ref={enumRef}
          data-testid="value-schema-enum"
          className="flex h-5 min-w-0 flex-nowrap items-center gap-1 overflow-hidden"
          // A clipped tag would otherwise stop mid-word; fade the last few
          // pixels so the cut reads as "there is more" next to the expand
          // control instead of looking broken.
          style={
            enumTruncated
              ? {
                  maskImage:
                    "linear-gradient(to right, black calc(100% - 18px), transparent)",
                }
              : undefined
          }
        >
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("engines.schema.enumLead")}
          </span>
          {/* Same tag treatment as the details panel, so a value looks the
              same wherever it appears; the row grows no taller for it. */}
          {row.enumValues.map((value) => (
            <code
              key={String(value)}
              className="shrink-0 rounded-[var(--nt-radius-checkbox)] border bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
            >
              {String(value)}
            </code>
          ))}
        </div>
      ) : null}
    </ExpandableCell>
  );
}

export function ValueSchemaTable({ schema }: ValueSchemaTableProps) {
  const { t } = useTranslation();
  const { rows, allowsAdditional } = useMemo(
    () => buildValueSchemaRows(schema),
    [schema],
  );
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [onlyRequired, setOnlyRequired] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const typeOptions = useMemo(() => valueSchemaTypeOptions(rows), [rows]);
  // Built-in packages declare no `required` at all (vLLM, SGLang, llama.cpp),
  // so on those the switch could only ever empty the table. Show it where it
  // can do something — and keep it while it is on, so switching to a version
  // without required parameters cannot strand the user on an empty table.
  const hasRequiredParameters = useMemo(
    () => rows.some((row) => row.required),
    [rows],
  );

  // The page scrolls this table, so both the toolbar and the column labels
  // stick to it. The header needs the toolbar's measured height as its offset,
  // otherwise the toolbar would cover it.
  useEffect(() => {
    const element = toolbarRef.current;
    if (!element) return undefined;
    const measure = () => setToolbarHeight(element.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const filtering = isValueSchemaFilterActive({
    query: search,
    type: typeFilter,
    onlyRequired,
  });

  const visibleRows = useMemo(() => {
    // Any active filter decides what is on screen and brings the ancestors of
    // a match along; a collapsed parent must not hide a row that matched.
    const filtered = filterValueSchemaRows(rows, {
      query: search,
      type: typeFilter,
      onlyRequired,
    });
    if (filtered) return filtered;
    return rows.filter((row) => {
      // Hide children whose ancestor is collapsed.
      let parentId = row.parentId;
      while (parentId) {
        if (collapsed.has(parentId)) return false;
        parentId =
          rows.find((candidate) => candidate.id === parentId)?.parentId ?? null;
      }
      return true;
    });
  }, [rows, search, typeFilter, onlyRequired, collapsed]);

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
      <div
        ref={toolbarRef}
        // No top padding and a matching negative offset: ShowPage's scroll
        // container has 4px of top padding, and without cancelling it a sliver
        // of the row behind shows above the stuck toolbar.
        className="sticky -top-1 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 bg-[var(--nt-fill-neutral-white)] px-1 pb-2"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("engines.schema.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Separator orientation="vertical" className="h-6" />
          <Select
            value={typeFilter || "all"}
            onValueChange={(value) =>
              setTypeFilter(value === "all" ? "" : value)
            }
          >
            <SelectTrigger
              className="w-[150px]"
              aria-label={t("engines.schema.filters.type")}
              data-testid="value-schema-type-filter"
            >
              <SelectValue placeholder={t("engines.schema.filters.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("engines.schema.filters.allTypes")}
              </SelectItem>
              {typeOptions.map((option) => (
                <SelectItem key={option} value={option} className="font-mono">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasRequiredParameters || onlyRequired ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="value-schema-only-required"
                checked={onlyRequired}
                onCheckedChange={(checked) => setOnlyRequired(checked === true)}
              />
              <Label
                htmlFor="value-schema-only-required"
                className="text-sm font-normal"
              >
                {t("engines.schema.filters.onlyRequired")}
              </Label>
            </div>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {filtering
            ? t("engines.schema.filteredCount", {
                visible: visibleRows.length,
                total: rows.length,
              })
            : t("engines.schema.parameterCount", { count: rows.length })}
        </span>
      </div>

      {/* The page scrolls the table: one scrollbar beats nesting a scroll area
          inside the page. The toolbar and the header stick to that scroll so
          search and column labels stay reachable. */}
      <div className="[&>div]:overflow-visible">
        <Table>
          {/* The primitive's header is translucent; a sticky header needs an
              opaque fill or the rows show through it. */}
          <TableHeader
            className="sticky z-10 bg-[var(--nt-fill-neutral-opaque-2)]"
            style={{
              top: Math.max(toolbarHeight - SHOW_PAGE_SCROLL_PADDING, 0),
            }}
          >
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
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground"
                  data-testid="value-schema-no-matches"
                >
                  {t("engines.schema.noMatches")}
                </TableCell>
              </TableRow>
            ) : null}
            {visibleRows.map((row) => (
              <TableRow
                key={row.id}
                data-testid="value-schema-row"
                data-path={row.id}
              >
                {/* `max-w-0` keeps a cell's content from sizing the column: an
                    unbreakable parameter name or a row of enum tags would
                    otherwise stretch the table past its container. */}
                <TableCell className="max-w-0 align-top">
                  <div
                    className="flex min-w-0 items-start gap-2"
                    style={{
                      paddingLeft:
                        Math.min(row.depth, MAX_NESTED_INDENT_LEVELS) *
                        NESTED_INDENT_STEP,
                    }}
                  >
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
                    {/* Everything in the cell shares one left edge: the label,
                        the machine name underneath and the nested count. */}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        {/* One consistent line box (leading-5) keeps the 20px
                            chevron centred on the label whatever the font size. */}
                        <span
                          className={cn(
                            "truncate leading-5",
                            row.title
                              ? "text-sm font-medium"
                              : "font-mono text-xs",
                          )}
                          // Nested rows show the field name and let the indent
                          // carry the hierarchy: the dotted path runs past the
                          // column at three levels and would truncate on every
                          // row. The full path stays in the tooltip.
                          title={row.path}
                        >
                          {row.title ??
                            (row.depth > MAX_NESTED_INDENT_LEVELS &&
                            row.parentName ? (
                              <>
                                <span className="text-muted-foreground">
                                  {row.parentName}.
                                </span>
                                {row.name}
                              </>
                            ) : (
                              row.name
                            ))}
                        </span>
                        {row.required ? (
                          <span className="inline-flex shrink-0 items-center rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            {t("engines.schema.required")}
                          </span>
                        ) : null}
                      </div>
                      {row.title ? (
                        <span
                          className="block truncate font-mono text-xs text-muted-foreground"
                          title={row.path}
                        >
                          {row.path}
                        </span>
                      ) : null}
                      {row.hasChildren ? (
                        // Shown expanded and collapsed: collapsed is exactly
                        // when the count is the only hint of what is inside.
                        // Attached information, so it stays quieter than the
                        // machine name above it.
                        <span className="block text-xs text-[var(--nt-text-neutral-quaternary)]">
                          {t("engines.schema.nestedCount", {
                            count: row.childCount,
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-0 align-top">
                  <TypeCell row={row} />
                </TableCell>
                <TableCell className="max-w-0 align-top">
                  <DefaultCell row={row} />
                </TableCell>
                <TableCell className="max-w-0 align-top">
                  <DetailsCell row={row} />
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
