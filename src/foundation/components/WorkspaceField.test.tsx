import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom ships neither of these, and the popover's positioning needs both.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const mockOnSearchChange = vi.fn();
const mockUseWorkspaceSearch = vi.fn();

vi.mock("@/foundation/hooks/use-workspace", () => ({
  ALL_WORKSPACES: "_all_",
  useWorkspaceSearch: () => mockUseWorkspaceSearch(),
}));

const SELECT_A_WORKSPACE = "Select a workspace";

const translate = (key: string) =>
  key === "workspaces.placeholders.selectWorkspace" ? SELECT_A_WORKSPACE : key;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: translate }),
}));

// The real FormControl needs a FormField context; Slot keeps the one behaviour
// this test depends on — forwarding the popover trigger's props to the button.
vi.mock("@/components/ui/form", async () => {
  const { Slot } = await import("@radix-ui/react-slot");
  return { FormControl: Slot };
});

import WorkspaceField from "./WorkspaceField";

const options = (...names: string[]) =>
  names.map((name) => ({ label: name, value: name }));

const openField = () =>
  fireEvent.click(screen.getByRole("combobox", { hidden: true }));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseWorkspaceSearch.mockReturnValue({
    options: options("ws-alpha", "ws-beta"),
    isLoading: false,
    onSearchChange: mockOnSearchChange,
  });
});

describe("WorkspaceField", () => {
  it("lists the workspaces the query returned", () => {
    render(<WorkspaceField />);
    openField();

    expect(screen.getByRole("option", { name: "ws-alpha" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "ws-beta" })).toBeTruthy();
  });

  it("hands what was typed to the search query instead of filtering locally", () => {
    render(<WorkspaceField />);
    openField();

    fireEvent.change(screen.getByPlaceholderText(SELECT_A_WORKSPACE), {
      target: { value: "132455" },
    });

    expect(mockOnSearchChange).toHaveBeenCalledWith("132455");
  });

  it("keeps the selected workspace listed when a search excludes it", () => {
    mockUseWorkspaceSearch.mockReturnValue({
      options: options("ws-alpha"),
      isLoading: false,
      onSearchChange: mockOnSearchChange,
    });

    render(<WorkspaceField value="ws-elsewhere" />);
    openField();

    // Matched as an option, not just as the trigger's label.
    expect(screen.getByRole("option", { name: "ws-elsewhere" })).toBeTruthy();
  });
});
