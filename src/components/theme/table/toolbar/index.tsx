import type { Table } from "@tanstack/react-table";

import { DataTableViewOptions } from "./table-view-options-dropdown";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2"></div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
