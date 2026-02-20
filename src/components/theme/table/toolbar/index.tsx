import { TableSearch } from "@/components/business/TableSearch";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Table } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { DataTableViewOptions } from "./table-view-options-dropdown";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  refineTable?: UseTableReturnType<any, any>;
  filters?: ReactNode;
  searchField?: string;
  actions?: ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  refineTable,
  filters,
  searchField,
  actions,
}: DataTableToolbarProps<TData>) {
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
