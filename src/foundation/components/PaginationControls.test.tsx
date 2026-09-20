import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PaginationControls } from "@/foundation/components/PaginationControls";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: object) =>
      options ? `${key}${JSON.stringify(options)}` : key,
  }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: object) =>
      options ? `${key}${JSON.stringify(options)}` : key,
  }),
}));

// jsdom has no pointer capture or scrollIntoView; Radix Select calls both while
// opening, and without them the option list never mounts.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const openSelect = (index: number) =>
  fireEvent.pointerDown(screen.getAllByRole("combobox")[index], {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });

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

    expect(screen.getByText("table.pagination.rowsPerPage")).toBeDefined();
    expect(screen.getByText("Total: 80 items")).toBeDefined();
    expect(
      screen.getByText('table.pagination.page{"current":1,"total":4}'),
    ).toBeDefined();

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
    expect(screen.getByText("Total: 30 items")).toBeDefined();
  });
});
