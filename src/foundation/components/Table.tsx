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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as TableUi,
} from "@/components/ui/table";
import { BatchDeleteBar } from "@/foundation/components/BatchDeleteBar";
import { Link } from "@/foundation/components/Link";
import { Loader } from "@/foundation/components/Loader";
import { TableSearch } from "@/foundation/components/TableSearch";
import { useColumnVisibility } from "@/foundation/hooks/use-column-visibility";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import {
  DeleteContext,
  DeleteProvider,
} from "@/foundation/providers/deleteProvider";
import {
  CaretDownIcon,
  CaretUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DotsHorizontalIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  MixerHorizontalIcon,
} from "@radix-ui/react-icons";
import type { PopoverContentProps } from "@radix-ui/react-popover";
import {
  type BaseOption,
  type BaseRecord,
  type CrudFilter,
  type HttpError,
  useResource,
  type useTableProps,
  useTranslate,
} from "@refinedev/core";
import { useNavigation } from "@refinedev/core";
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
  type Row,
  type TableOptionsResolved,
  type Table as TanStackTable,
  flexRender,
} from "@tanstack/react-table";
import type React from "react";
import {
  type FC,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";

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
  header?:
    | string
    | FC<{
        table: UseTableReturnType<TData, TError>;
      }>;
  cell?: ColumnDefTemplate<CellContext<TData, TValue>>;
  children?: ReactElement;
  filter?: FC<TableFilterProps<TData>>;
};

type CustomColumnDef<
  TData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
> = ColumnDef<TData, TError> & Pick<ColumnProps<TData, TError>, "filter">;

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
}: { table: UseTableReturnType<TData> }) => {
  const t = useTranslate();
  const total = table.refineCore.tableQuery.data?.total ?? 0;

  return (
    <div className="flex flex-col sm:flex-row gap-y-4 sm-gap-y-0 items-center justify-between">
      <div className="flex-1 text-sm text-muted-foreground">
        {t("table.pagination.totalItems", { total })}
      </div>
      <div className="flex relative flex-col-reverse gap-y-4 sm:gap-y-0 sm:flex-row items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">
            {t("table.pagination.rowsPerPage")}
          </p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          {t("table.pagination.page", {
            current: table.getState().pagination.pageIndex + 1,
            total: table.getPageCount(),
          })}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">
              {t("table.pagination.goToFirstPage")}
            </span>
            <DoubleArrowLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">
              {t("table.pagination.goToPreviousPage")}
            </span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">
              {t("table.pagination.goToNextPage")}
            </span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">
              {t("table.pagination.goToLastPage")}
            </span>
            <DoubleArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Row Actions
// ============================================================================

export const RowAction: FC<RowActionProps> = (props) => {
  return (
    <DropdownMenuItem
      disabled={props.disabled}
      asChild={!(!props.to || (!props.to && !props.children))}
      onClick={props.onClick}
    >
      {props.asChild ? (
        props.children
      ) : props.to ? (
        <Link href={props.to} title={props.title} className="hover:bg-accent">
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
  const meta = row.metadata;
  const deleteContext = useContext(DeleteContext);

  return (
    <RowAction
      {...props}
      disabled={disabled}
      title={title}
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

const DataTableViewOptions = <TData,>({
  table,
}: { table: TanStackTable<TData> }) => {
  const t = useTranslate();
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
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 lg:flex"
        >
          <MixerHorizontalIcon className="mr-2 h-4 w-4" />
          {t("table.columns")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
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
              {column?.columnDef?.header?.toString() || t(column.id)}
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
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        {searchField && refineTable && (
          <TableSearch field={searchField} table={refineTable} />
        )}
        {filters}
      </div>
      <div className="flex items-center space-x-2">
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
  const t = useTranslate();
  const { resource } = useResource();

  // Column visibility persistence
  const {
    columnVisibility,
    setColumnVisibility: saveColumnVisibility,
    isLoaded,
  } = useColumnVisibility(resource?.name || "");

  const mapColumn = useCallback(
    ({
      id,
      accessorKey,
      header,
      enableSorting,
      enableHiding,
      filter,
      cell,
    }: ColumnProps<TData, TError>): ColumnDef<TData> => {
      const column: ColumnDef<TData> = {
        id,
        header,
        accessorKey,
        enableSorting: enableSorting ?? false,
        enableHiding: enableHiding ?? false,
        enableColumnFilter: true,
        enableResizing: true,
        ...((filter as FC<TableFilterProps<TData>>) && { filter }),
      } as ColumnDef<TData>;

      if (cell) {
        column.cell = cell;
      }

      return column;
    },
    [],
  );

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
          .map(mapColumn),
      );
    }

    return cols;
  }, [children, mapColumn, enableBatchDelete, t]);

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
      queryOptions: {
        refetchInterval: 3_000,
        refetchIntervalInBackground: true,
      },
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
                        .columnDef as CustomColumnDef<TData, TError>;
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
                              columnDef?.filter &&
                              columnDef.filter({
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
