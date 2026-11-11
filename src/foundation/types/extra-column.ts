import type { ReactNode } from "react";

/** A table column another domain fills in, e.g. each row's limits. */
export type ExtraColumn<Row> = {
  header: string;
  render: (row: Row) => ReactNode;
};
