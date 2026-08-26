import type { Column } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import {
  getColumnViewOptionsLabel,
  mapTableColumn,
  TABLE_SELECTION_COLUMN_WIDTH,
} from "./Table";

vi.mock("@refinedev/react-table", () => ({
  useTable: vi.fn(),
}));

const makeColumn = ({
  id,
  header,
  viewOptionsLabel,
}: {
  id: string;
  header?: unknown;
  viewOptionsLabel?: string;
}) =>
  ({
    id,
    columnDef: {
      header,
      meta: viewOptionsLabel ? { viewOptionsLabel } : undefined,
    },
  }) as Column<unknown>;

describe("getColumnViewOptionsLabel", () => {
  it("uses explicit view options label for function headers", () => {
    const label = getColumnViewOptionsLabel(
      makeColumn({
        id: "accelerator_virtualization",
        header: () => null,
        viewOptionsLabel: "Accelerator Virtualization",
      }),
      (key) => key,
    );

    expect(label).toBe("Accelerator Virtualization");
  });

  it("uses string header labels directly", () => {
    const label = getColumnViewOptionsLabel(
      makeColumn({
        id: "status",
        header: "Status",
      }),
      (key) => key,
    );

    expect(label).toBe("Status");
  });

  it("uses translated column IDs when a non-string header has no explicit label", () => {
    const label = getColumnViewOptionsLabel(
      makeColumn({
        id: "accelerator_virtualization",
        header: () => null,
      }),
      (key) =>
        key === "accelerator_virtualization"
          ? "Accelerator Virtualization"
          : key,
    );

    expect(label).toBe("Accelerator Virtualization");
  });

  it("humanizes column IDs when no translation exists", () => {
    const label = getColumnViewOptionsLabel(
      makeColumn({
        id: "metadata->creation_timestamp",
        header: () => null,
      }),
      (key) => key,
    );

    expect(label).toBe("metadata creation timestamp");
  });
});

describe("Table", () => {
  it("keeps the shared row-selection column at a fixed width", () => {
    expect(TABLE_SELECTION_COLUMN_WIDTH).toBe(48);
  });

  it("passes column view options labels into column metadata", () => {
    const acceleratorColumn = mapTableColumn({
      id: "accelerator_virtualization",
      accessorKey: "spec.accelerator_virtualization",
      header: () => null,
      viewOptionsLabel: "Accelerator Virtualization",
    });
    const statusColumn = mapTableColumn({
      id: "status",
      accessorKey: "status",
      header: "Status",
    });

    expect(acceleratorColumn?.meta).toEqual({
      viewOptionsLabel: "Accelerator Virtualization",
    });
    expect(statusColumn?.meta).toBeUndefined();
  });
});
