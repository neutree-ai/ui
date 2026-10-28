import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaginationControls } from "@/foundation/components/PaginationControls";
import { openMenu } from "@/foundation/testing/interactions";

const openSelect = (index: number) =>
  openMenu(screen.getAllByRole("combobox")[index]);

describe("PaginationControls", () => {
  it("offers the rows-per-page control to callers that let the reader change it", () => {
    const onPageSizeChange = vi.fn();
    render(
      <PaginationControls
        page={1}
        pageCount={4}
        pageSize={20}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
        summary="Total: 80 items"
      />,
    );

    screen.getByText("table.pagination.rowsPerPage");
    screen.getByText("Total: 80 items");
    screen.getByText("table.pagination.page:1,4");

    openSelect(0);
    const twenty = screen
      .getAllByRole("option")
      .find((option) => option.textContent === "50");
    if (!twenty) throw new Error("no 50 option");
    fireEvent.click(twenty);

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("reports first, previous, next and last page requests", () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        page={2}
        pageCount={4}
        pageSize={10}
        onPageChange={onPageChange}
        showPageSize={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "table.pagination.goToFirstPage" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "table.pagination.goToPreviousPage" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "table.pagination.goToNextPage" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "table.pagination.goToLastPage" }),
    );

    expect(onPageChange.mock.calls.map(([page]) => page)).toEqual([1, 1, 3, 4]);
  });

  it("hides it for callers that own the page size themselves", () => {
    render(
      <PaginationControls
        page={2}
        pageCount={3}
        pageSize={10}
        onPageChange={() => {}}
        showPageSize={false}
        summary="Total: 30 items"
      />,
    );

    expect(screen.queryByText("table.pagination.rowsPerPage")).toBeNull();
    screen.getByText("Total: 30 items");
  });
});
