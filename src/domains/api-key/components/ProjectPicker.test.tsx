import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const refetch = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync }),
}));

vi.mock("@/domains/api-key/hooks/use-api-key-projects", () => ({
  useApiKeyProjects: () => ({
    data: [
      { id: "default", name: "Default", description: "", enabled: true },
      { id: "active", name: "Active", description: "Ready", enabled: true },
      {
        id: "disabled",
        name: "Disabled",
        description: "History",
        enabled: false,
      },
    ],
    isLoading: false,
    error: "",
    refetch,
  }),
}));

import { ProjectPicker } from "./ProjectPicker";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

describe("ProjectPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows disabled projects but prevents selecting them", () => {
    render(<ProjectPicker workspace="default" value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    const option = screen.getByRole("option", { name: /Disabled.*History/ });
    expect(option.getAttribute("aria-disabled")).toBe("true");
  });

  it("selects the Default project for create forms", async () => {
    const onChange = vi.fn();
    render(
      <ProjectPicker
        workspace="default"
        value=""
        onChange={onChange}
        selectDefaultWhenEmpty
      />,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("default"));
  });

  it("creates a project inline, refreshes, and selects it", async () => {
    const onChange = vi.fn();
    mutateAsync.mockResolvedValue({ data: { id: "new", name: "New" } });
    render(<ProjectPicker workspace="default" value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Create Project/ }));
    fireEvent.change(screen.getByPlaceholderText("Project name"), {
      target: { value: "New" },
    });
    fireEvent.change(screen.getByPlaceholderText("Description (optional)"), {
      target: { value: "Calls" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create and select" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("new"));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        values: {
          p_workspace: "default",
          p_name: "New",
          p_description: "Calls",
        },
      }),
    );
    expect(refetch).toHaveBeenCalled();
  });
});
