import type { useTableProps } from "@refinedev/core";

export const defaultSorters: useTableProps<any, any, any>["sorters"] = {
  initial: [
    {
      field: "metadata->creation_timestamp",
      order: "desc",
    },
  ],
};
