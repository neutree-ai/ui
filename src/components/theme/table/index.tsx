import Loader from "@/components/theme/components/loader";
import { DeleteProvider } from "@/components/theme/providers";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as TableUi,
} from "@/components/ui/table";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import type { PopoverContentProps } from "@radix-ui/react-popover";
import {
  type BaseOption,
  type BaseRecord,
  type CrudFilter,
  type HttpError,
  useResource,
  useTranslate,
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
  type Row,
  type TableOptionsResolved,
  flexRender,
} from "@tanstack/react-table";
import type React from "react";
import {
  type FC,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { RowAction, RowActions } from "./actions";
import { DeleteAction } from "./actions/delete";
import { EditAction } from "./actions/edit";
import { ShowAction } from "./actions/show";
import {
  TableFilterDateRangePickerFilter,
  TableFilterDropdown,
  TableFilterSearchColumn,
} from "./fields";
import { CheckAll } from "./fields/checkall";
import { Pagination } from "./fields/pagination";
import { SortAction } from "./fields/sort";
import { DataTableToolbar } from "./toolbar";

export type TableListFilterOption = BaseOption & {
  icon?: React.ComponentType<{ className?: string }>;
};

export type TableFilterProps<TData extends BaseRecord = BaseRecord> = {
  column: Column<TData>;
  title?: string;
  numberOfMonths?: number;
  align?: PopoverContentProps["align"];
  options?: TableListFilterOption[];
};

export type ColumnProps<
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

export type TableProps<
  TData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
> = Partial<UseTableProps<TData, TError, TData>> & {
  children?: ReactElement<ColumnProps<TData, TError>>[];
  showHeader?: boolean;
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

export function Table<
  TQueryFnData extends BaseRecord = BaseRecord,
  TData extends BaseRecord = TQueryFnData,
  TError extends HttpError = HttpError,
>({
  children,
  showHeader = true,
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
    if (Array.isArray(children)) {
      return (children as ReactElement[])
        .map((value: ReactElement) => value.props)
        .map(mapColumn);
    }

    return [];
  }, [children, mapColumn]);

  // Extract valid column IDs for cleanup
  const validColumnIds = useMemo(
    () => columns.map((col) => col.id as string).filter(Boolean),
    [columns],
  );

  const table = useTable({
    columns,
    ...props,
    refineCoreProps: {
      queryOptions: {
        refetchInterval: 3_000,
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
      <div className="space-y-4">
        <DataTableToolbar
          table={table}
          filters={
            typeof filters === "function"
              ? filters({
                  filters: table.refineCore.filters,
                  setFilters: table.refineCore.setFilters,
                })
              : filters
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
            <TableBody>
              {table.refineCore.tableQuery.isLoading ? (
                <TableRow>
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
                <TableRow>
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

const TableColumn = <
  TData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
>(
  props: ColumnProps<TData, TError>,
) => {
  return props.children;
};

Table.Column = TableColumn;
Table.CheckAll = CheckAll;
Table.Actions = RowActions;
Table.Action = RowAction;
Table.EditAction = EditAction;
Table.ShowAction = ShowAction;
Table.DeleteAction = DeleteAction;
Table.Filter = {
  DateRangePicker: TableFilterDateRangePickerFilter,
  Dropdown: TableFilterDropdown,
  Search: TableFilterSearchColumn,
};

Table.displayName = "Table";
