import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type NameOption, TraceNameFilter } from "./TraceNameFilter";

// cmdk observes and scrolls its list; jsdom implements neither.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = vi.fn();

const NAMES = ["qwen3-chat", "qwen3-embed", "deepseek-ocr"];
const OPTIONS = NAMES.map((name) => ({ name }));

function renderFilter(
  value = "",
  options: NameOption[] = OPTIONS,
  notice?: string,
) {
  const onChange = vi.fn();
  render(
    <TraceNameFilter
      data-testid="name-filter"
      label="Endpoint name"
      allLabel="All endpoints"
      searchPlaceholder="Search"
      options={options}
      notice={notice}
      value={value}
      onChange={onChange}
    />,
  );
  return onChange;
}

function openFilter(
  value = "",
  options: NameOption[] = OPTIONS,
  notice?: string,
) {
  const onChange = renderFilter(value, options, notice);
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

    expect(namesInList()).toEqual(["All endpoints", ...NAMES]);
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
      ...NAMES,
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

  it("tells apart options that share a name by their tag", () => {
    const { onChange } = openFilter("", [
      { name: "chat", tag: "endpoint" },
      { name: "chat", tag: "external-endpoint" },
    ]);

    expect(namesInList()).toEqual([
      "All endpoints",
      "chatendpoint",
      "chatexternal-endpoint",
    ]);
    fireEvent.click(screen.getByRole("option", { name: /external-endpoint/ }));
    expect(onChange).toHaveBeenCalledWith("chat");
  });

  it("shows the notice under the list", () => {
    openFilter("", OPTIONS, "Only some values are listed.");

    expect(screen.getByText("Only some values are listed.")).toBeTruthy();
  });

  it("offers a typed name when there are no suggestions", () => {
    const { onChange, search } = openFilter("", []);

    fireEvent.change(search, { target: { value: "chat" } });
    clickOption("chat");

    expect(onChange).toHaveBeenCalledWith("chat");
  });
});
