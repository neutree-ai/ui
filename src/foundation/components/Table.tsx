import {
  CaretDownIcon,
  CaretUpIcon,
  DotsHorizontalIcon,
  MixerHorizontalIcon,
} from "@radix-ui/react-icons";
import type { PopoverContentProps } from "@radix-ui/react-popover";
import {
  type BaseOption,
  type BaseRecord,
  type CrudFilter,
  type HttpError,
  useNavigation,
  useResource,
  type useTableProps,
} from "@refinedev/core";
import {
  type UseTableProps,
  type UseTableReturnType,
  useTable,
} from "@refinedev/react-table";
import {
  type Cell,
  type CellContext,
  type Column,
  type ColumnDef,
  type ColumnDefTemplate,
  flexRender,
  type Row,
  type TableOptionsResolved,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import type React from "react";
import {
  type FC,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as TableUi,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BatchDeleteBar } from "@/foundation/components/BatchDeleteBar";
import { Link } from "@/foundation/components/Link";
import { Loader } from "@/foundation/components/Loader";
import { PaginationControls } from "@/foundation/components/PaginationControls";
import { TableSearch } from "@/foundation/components/TableSearch";
import { useColumnVisibility } from "@/foundation/hooks/use-column-visibility";
import { LIST_POLL_QUERY_OPTIONS } from "@/foundation/lib/constant";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import {
  DeleteContext,
  DeleteProvider,
} from "@/foundation/providers/delete-provider";

// ============================================================================
// Types
// ============================================================================

export type TableListFilterOption = BaseOption & {
  icon?: React.ComponentType<{ className?: string }>;
};

type TableFilterProps<TData extends BaseRecord = BaseRecord> = {
  column: Column<TData>;
  title?: string;
  numberOfMonths?: number;
  align?: PopoverContentProps["align"];
  options?: TableListFilterOption[];
};

type ColumnProps<
  TData extends BaseRecord = BaseRecord,
  TValue = unknown,
  TError extends HttpError = HttpError,
> = {
  id: string;
  accessorKey: string;
  enableSorting?: boolean;
  enableHiding?: boolean;
  viewOptionsLabel?: string;
  header?:
    | string
    | FC<{
        table: UseTableReturnType<TData, TError>;
      }>;
  cell?: ColumnDefTemplate<CellContext<TData, TValue>>;
  children?: ReactElement;
  filter?: FC<TableFilterProps<TData>>;
};

type CustomColumnDef<TData extends BaseRecord = BaseRecord> = ColumnDef<TData> &
  Pick<ColumnProps<TData>, "filter">;

type ColumnViewOptionsMeta = {
  viewOptionsLabel?: string;
};

export const mapTableColumn = <
  TData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
>({
  id,
  accessorKey,
  header,
  enableSorting,
  enableHiding,
  viewOptionsLabel,
  filter,
  cell,
}: ColumnProps<TData, unknown, TError>): CustomColumnDef<TData> => {
  const column: CustomColumnDef<TData> = {
    id,
    header,
    accessorKey,
    enableSorting: enableSorting ?? false,
    enableHiding: enableHiding ?? false,
    enableColumnFilter: true,
    enableResizing: true,
    ...(viewOptionsLabel && { meta: { viewOptionsLabel } }),
    ...((filter as FC<TableFilterProps<TData>>) && { filter }),
  } as ColumnDef<TData>;

  if (cell) {
    column.cell = cell;
  }

  return column;
};

type TableProps<
  TData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
> = Partial<UseTableProps<TData, TError, TData>> & {
  children?: ReactElement<ColumnProps<TData, TError>>[];
  showHeader?: boolean;
  enableBatchDelete?: boolean;
  searchField?: string;
  filters?:
    | ReactElement
    | ((props: {
        filters: CrudFilter[];
        setFilters: (
          filters: CrudFilter[],
          behavior?: "merge" | "replace",
        ) => void;
      }) => ReactElement);
};

export type RowActionProps = PropsWithChildren & {
  to?: string;
  title?: string;
  asChild?: boolean;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: (event: React.MouseEvent) => void;
  variant?: "default" | "destructive";
};

// ============================================================================
// Sort Action (internal)
// ============================================================================

const SortAction = <TData extends BaseRecord = BaseRecord>({
  column,
}: Pick<TableFilterProps<TData>, "column">) => {
  return (
    <div
      className="cursor-pointer"
      data-testid="sort-trigger"
      data-sort-direction={column?.getIsSorted() || "none"}
      onClick={() => {
        column?.toggleSorting(column?.getIsSorted() === "asc");
      }}
    >
      <div className="inline-flex flex-col">
        <CaretUpIcon
          className={cn(
            "-mb-1.5 w-5 h-5 text-foreground",
            column?.getIsSorted() === "asc" ? "opacity-100" : "opacity-30",
          )}
        />
        <CaretDownIcon
          className={cn(
            "-mt-1.5 w-5 h-5 text-foreground",
            column?.getIsSorted() === "desc" ? "opacity-100" : "opacity-30",
          )}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Pagination (internal)
// ============================================================================

const Pagination = <TData extends BaseRecord = BaseRecord>({
  table,
}: {
  table: UseTableReturnType<TData>;
}) => {
  const { t } = useTranslation();
  const total = table.refineCore.tableQuery.data?.total ?? 0;

  return (
    <PaginationControls
      page={table.getState().pagination.pageIndex + 1}
      pageCount={table.getPageCount()}
      pageSize={table.getState().pagination.pageSize}
      onPageChange={(page) => table.setPageIndex(page - 1)}
      onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
      summary={t("table.pagination.totalItems", { total })}
    />
  );
};

// ============================================================================
// Row Actions
// ============================================================================

export const RowAction: FC<RowActionProps> = (props) => {
  return (
    <DropdownMenuItem
      className={props.className}
      data-variant={props.variant}
      disabled={props.disabled}
      asChild={!(!props.to || (!props.to && !props.children))}
      onClick={props.onClick}
    >
      {props.asChild ? (
        props.children
      ) : props.to ? (
        <Link href={props.to}>
          {props.icon ? <span className="mr-2">{props.icon}</span> : null}
          {props.title}
        </Link>
      ) : (
        <>
          {props.icon ? <span className="mr-2">{props.icon}</span> : null}
          {props.title}
        </>
      )}
    </DropdownMenuItem>
  );
};

RowAction.displayName = "RowAction";

function RowActions({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="row-actions-trigger">
          <DotsHorizontalIcon className="h-4 w-4" />
          <span className="sr-only">{t("accessibility.openMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Delete / Edit / Show Actions
// ============================================================================

type DeleteActionProps = RowActionProps & {
  row: any;
  resource: string;
  title: string;
  onAfterHandle?: () => void;
};

export function DeleteAction({
  row,
  resource,
  title,
  disabled,
  onAfterHandle,
  ...props
}: DeleteActionProps) {
  const _meta = row.metadata;
  const deleteContext = useContext(DeleteContext);

  return (
    <RowAction
      {...props}
      disabled={disabled}
      title={title}
      variant="destructive"
      onClick={() =>
        deleteContext?.updateData({
          row,
          resource,
          toogle: true,
          onAfterHandle,
        })
      }
    />
  );
}

DeleteAction.displayName = "DeleteAction";

type EditActionProps = RowActionProps & {
  row: any;
  resource: string;
  title: string;
};

export function EditAction({
  row,
  resource,
  title,
  disabled,
  ...props
}: EditActionProps) {
  const navigation = useNavigation();
  const editUrl = navigation.editUrl(resource, row.metadata.name, row.metadata);

  return (
    <RowAction {...props} disabled={disabled} title={title} to={editUrl} />
  );
}

EditAction.displayName = "EditAction";

// ============================================================================
// DataTableViewOptions (internal)
// ============================================================================

export const getColumnViewOptionsLabel = <TData,>(
  column: Column<TData>,
  t: (key: string) => string,
) => {
  const meta = column.columnDef.meta as ColumnViewOptionsMeta | undefined;
  if (meta?.viewOptionsLabel) {
    return meta.viewOptionsLabel;
  }

  const header = column.columnDef.header;
  if (typeof header === "string") {
    return header;
  }

  const translatedLabel = t(column.id);
  return translatedLabel === column.id
    ? column.id.replace(/[_>-]+/g, " ").trim()
    : translatedLabel;
};

const DataTableViewOptions = <TData,>({
  table,
}: {
  table: TanStackTable<TData>;
}) => {
  const { t } = useTranslation();
  const columns = useMemo(() => {
    return table
      .getAllColumns()
      .filter(
        (column) =>
          typeof column.accessorFn !== "undefined" && column.getCanHide(),
      );
  }, [table]);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="ml-auto hidden h-8 w-8 lg:inline-flex"
              aria-label={t("table.columns")}
              title={t("table.columns")}
            >
              <MixerHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("table.columns")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel>{t("table.toggleColumns")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(value)}
            >
              {getColumnViewOptionsLabel(column, t)}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

DataTableViewOptions.displayName = "DataTableViewOptions";

// ============================================================================
// DataTableToolbar (internal)
// ============================================================================

function DataTableToolbar<TData>({
  table,
  refineTable,
  filters,
  searchField,
  actions,
}: {
  table: TanStackTable<TData>;
  refineTable?: UseTableReturnType<any, any>;
  filters?: ReactNode;
  searchField?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {searchField && refineTable && (
          <TableSearch field={searchField} table={refineTable} />
        )}
        {filters}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}

// ============================================================================
// Main Table Component
// ============================================================================

export function Table<
  TQueryFnData extends BaseRecord = BaseRecord,
  TData extends BaseRecord = TQueryFnData,
  TError extends HttpError = HttpError,
>({
  children,
  showHeader = true,
  enableBatchDelete = false,
  searchField,
  columns = [],
  filters,
  ...props
}: TableProps<TData, TError>) {
  const { t } = useTranslation();
  const { resource } = useResource();

  // Column visibility persistence
  const {
    columnVisibility,
    setColumnVisibility: saveColumnVisibility,
    isLoaded,
  } = useColumnVisibility(resource?.name || "");

  columns = useMemo<ColumnDef<TData>[]>(() => {
    const cols: ColumnDef<TData>[] = [];

    if (enableBatchDelete) {
      cols.push({
        id: "_select",
        header: ({ table: tbl }) => (
          <Checkbox
            checked={
              tbl.getIsSomeRowsSelected()
                ? "indeterminate"
                : tbl.getIsAllPageRowsSelected()
            }
            onCheckedChange={(value) => tbl.toggleAllPageRowsSelected(!!value)}
            aria-label={t("table.selectAll")}
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t("table.selectRow")}
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      } as ColumnDef<TData>);
    }

    if (Array.isArray(children)) {
      cols.push(
        ...(children as ReactElement[])
          .map((value: ReactElement) => value.props)
          .map((props) => mapTableColumn<TData, TError>(props)),
      );
    }

    return cols;
  }, [children, enableBatchDelete, t]);

  // Extract valid column IDs for cleanup
  const validColumnIds = useMemo(
    () => columns.map((col) => col.id as string).filter(Boolean),
    [columns],
  );

  const table = useTable({
    columns,
    ...props,
    enableRowSelection: enableBatchDelete,
    refineCoreProps: {
      queryOptions: { ...LIST_POLL_QUERY_OPTIONS },
      ...props.refineCoreProps,
    },
    initialState: {
      columnVisibility: {},
      ...props.initialState,
    },
    state: {
      columnVisibility: isLoaded ? columnVisibility : {},
      ...props.state,
    },
    onColumnVisibilityChange: (updater) => {
      if (!isLoaded) return;
      saveColumnVisibility(updater, validColumnIds);
    },
  });

  const tableOptions = useMemo<TableOptionsResolved<TData>>(
    () => table.options,
    [table],
  );

  const isFilterable = useMemo<boolean>(
    () =>
      Boolean(tableOptions.enableColumnFilters || tableOptions?.enableFilters),
    [tableOptions],
  );

  return (
    <DeleteProvider>
      <div className="space-y-4" data-testid="table">
        <DataTableToolbar
          table={table}
          refineTable={table}
          searchField={searchField}
          filters={
            typeof filters === "function"
              ? filters({
                  filters: table.refineCore.filters,
                  setFilters: table.refineCore.setFilters,
                })
              : filters
          }
          actions={
            enableBatchDelete ? (
              <BatchDeleteBar
                selectedRows={table.getSelectedRowModel().rows}
                onDeleted={() => table.resetRowSelection()}
              />
            ) : undefined
          }
        />
        <div className="rounded-md border border-border">
          <TableUi>
            {showHeader && (
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const columnDef = header.column
                        .columnDef as CustomColumnDef<TData>;
                      return (
                        <TableHead key={header.id}>
                          <div className="inline-flex flex-row items-center gap-x-2.5">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                            {tableOptions.enableSorting &&
                              columnDef.enableSorting && (
                                <SortAction column={header.column} />
                              )}
                            {isFilterable &&
                              columnDef?.filter?.({
                                column: header.column,
                                title: t("table.filter", {
                                  column: columnDef.header,
                                }),
                              })}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
            )}
            <TableBody data-testid="table-body">
              {table.refineCore.tableQuery.isLoading ? (
                <TableRow data-testid="table-loading">
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-nowrap"
                  >
                    <div className="flex items-center justify-center flex-row">
                      <Loader className="h-4 text-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row: Row<TData>) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell: Cell<TData, unknown>) => (
                      <TableCell key={cell.id} className="text-nowrap">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow data-testid="table-empty">
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {t("table.noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </TableUi>
        </div>
        <Pagination table={table} />
      </div>
    </DeleteProvider>
  );
}

// ============================================================================
// Table sub-component assignments
// ============================================================================

const TableColumn = <
  TData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
>(
  props: ColumnProps<TData, TError>,
) => {
  return props.children;
};

Table.Column = TableColumn;
Table.Actions = RowActions;
Table.EditAction = EditAction;
Table.DeleteAction = DeleteAction;

Table.displayName = "Table";

// ============================================================================
// Default Sorters
// ============================================================================

export const defaultSorters: useTableProps<any, any, any>["sorters"] = {
  initial: [
    {
      field: "metadata->creation_timestamp",
      order: "desc",
    },
  ],
};
