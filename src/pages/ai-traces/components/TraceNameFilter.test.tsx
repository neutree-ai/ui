import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TraceNameFilter } from "./TraceNameFilter";

// cmdk observes and scrolls its list; jsdom implements neither.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = vi.fn();

const OPTIONS = ["qwen3-chat", "qwen3-embed", "deepseek-ocr"];

function renderFilter(value = "", options = OPTIONS) {
  const onChange = vi.fn();
  render(
    <TraceNameFilter
      data-testid="name-filter"
      label="Endpoint name"
      allLabel="All endpoints"
      searchPlaceholder="Search"
      options={options}
      value={value}
      onChange={onChange}
    />,
  );
  return onChange;
}

function openFilter(value = "") {
  const onChange = renderFilter(value);
  fireEvent.click(screen.getByTestId("name-filter"));
  return { onChange, search: screen.getByPlaceholderText("Search") };
}

const namesInList = () =>
  screen.queryAllByRole("option").map((el) => el.textContent);

/** Clicks an option in the popover (the trigger can show the same text). */
const clickOption = (name: string) =>
  fireEvent.click(within(screen.getByRole("listbox")).getByText(name));

describe("TraceNameFilter", () => {
  it("names the unfiltered state on the closed control", () => {
    renderFilter();

    expect(
      screen.getByRole("combobox", { name: "Endpoint name" }).textContent,
    ).toBe("All endpoints");
  });

  it("lists the known names under the no-filter entry", () => {
    openFilter();

    expect(namesInList()).toEqual(["All endpoints", ...OPTIONS]);
  });

  it("selects a listed name", () => {
    const { onChange } = openFilter();

    clickOption("deepseek-ocr");

    expect(onChange).toHaveBeenCalledWith("deepseek-ocr");
  });

  it("narrows the list by a case-insensitive substring", () => {
    const { search } = openFilter();

    fireEvent.change(search, { target: { value: "QWEN3" } });

    expect(namesInList()).toEqual(["qwen3-chat", "qwen3-embed", "QWEN3"]);
  });

  it("offers a name that is not listed, after the listed matches", () => {
    const { onChange, search } = openFilter();

    fireEvent.change(search, { target: { value: " removed-endpoint " } });

    expect(namesInList()).toEqual(["removed-endpoint"]);
    clickOption("removed-endpoint");
    expect(onChange).toHaveBeenCalledWith("removed-endpoint");
  });

  it("does not offer a typed name twice when it is already listed", () => {
    const { search } = openFilter();

    fireEvent.change(search, { target: { value: "deepseek-ocr" } });

    expect(namesInList()).toEqual(["deepseek-ocr"]);
  });

  it("keeps a selected name that is no longer listed", () => {
    openFilter("removed-endpoint");

    expect(screen.getByTestId("name-filter").textContent).toBe(
      "removed-endpoint",
    );
    expect(namesInList()).toEqual([
      "All endpoints",
      "removed-endpoint",
      ...OPTIONS,
    ]);
  });

  it("clears the filter from the no-filter entry", () => {
    const { onChange } = openFilter("qwen3-chat");

    clickOption("All endpoints");

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("clears the filter when the selected name is picked again", () => {
    const { onChange } = openFilter("qwen3-chat");

    clickOption("qwen3-chat");

    expect(onChange).toHaveBeenCalledWith("");
  });
});
