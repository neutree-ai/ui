import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { StatusCodeFilter } from "./StatusCodeFilter";

// cmdk observes and scrolls its list; jsdom implements neither.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = vi.fn();

function openFilter(value = "") {
  const onChange = vi.fn();
  render(<StatusCodeFilter value={value} onChange={onChange} />);
  fireEvent.click(screen.getByTestId("status-filter"));
  return {
    onChange,
    search: screen.getByPlaceholderText("ai_traces.filters.statusSearch"),
  };
}

const codesInList = () =>
  screen
    .queryAllByRole("option")
    .map((el) => el.getAttribute("data-value"))
    .filter((v) => v !== "all");

/** Clicks an option in the popover (the trigger can show the same text). */
const clickOption = (name: string) =>
  fireEvent.click(within(screen.getByRole("listbox")).getByText(name));

describe("StatusCodeFilter", () => {
  it("suggests the well-known codes, including 499", () => {
    openFilter();

    expect(codesInList()).toEqual([
      "200",
      "400",
      "401",
      "403",
      "404",
      "408",
      "429",
      "499",
      "500",
      "502",
      "503",
      "504",
    ]);
  });

  it("selects a suggested code", () => {
    const { onChange } = openFilter();

    clickOption("499");

    expect(onChange).toHaveBeenCalledWith("499");
  });

  it("offers an unlisted code that the user types", () => {
    const { onChange, search } = openFilter();

    fireEvent.change(search, { target: { value: "418" } });
    expect(codesInList()).toEqual(["418"]);

    clickOption("418");
    expect(onChange).toHaveBeenCalledWith("418");
  });

  it("does not duplicate a typed code that is already suggested", () => {
    const { search } = openFilter();

    fireEvent.change(search, { target: { value: "429" } });

    expect(codesInList()).toEqual(["429"]);
  });

  it("shows a hint instead of an option for implausible input", () => {
    const { search } = openFilter();

    fireEvent.change(search, { target: { value: "12" } });

    expect(codesInList()).toEqual([]);
    expect(screen.getByText("ai_traces.filters.statusHint")).toBeTruthy();
  });

  it("keeps a previously picked unlisted code in the list", () => {
    openFilter("418");

    expect(screen.getByTestId("status-filter").textContent).toContain("418");
    // Sorted into place between 408 and 429 rather than appended.
    expect(codesInList()).toContain("418");
    expect(codesInList().indexOf("418")).toBe(codesInList().indexOf("408") + 1);
  });

  it("clears the filter when the selected code is picked again", () => {
    const { onChange } = openFilter("429");

    clickOption("429");

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("selects all statuses", () => {
    const { onChange } = openFilter("429");

    clickOption("ai_traces.filters.allStatuses");

    expect(onChange).toHaveBeenCalledWith("");
  });
});
