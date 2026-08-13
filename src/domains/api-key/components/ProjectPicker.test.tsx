import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const invalidate = vi.fn();

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    data: {
      data: [
        { id: "active", name: "Active", description: "Ready", enabled: true },
        { id: "disabled", name: "Disabled", description: "History", enabled: false },
      ],
    },
    isLoading: false,
  }),
  useCustomMutation: () => ({ mutateAsync }),
  useInvalidate: () => invalidate,
}));

import { ProjectPicker } from "./ProjectPicker";

describe("ProjectPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows disabled projects but prevents selecting them", () => {
    render(<ProjectPicker workspace="default" value="" onChange={vi.fn()} />);
    const option = screen.getByRole("option", { name: /Disabled.*History.*Disabled/ });
    expect((option as HTMLOptionElement).disabled).toBe(true);
  });

  it("creates a project inline, refreshes, and selects it", async () => {
    const onChange = vi.fn();
    mutateAsync.mockResolvedValue({ data: { id: "new", name: "New" } });
    render(<ProjectPicker workspace="default" value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Create Project/ }));
    fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "New" } });
    fireEvent.change(screen.getByPlaceholderText("Description (optional)"), { target: { value: "Calls" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and select" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("new"));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ values: { p_workspace: "default", p_name: "New", p_description: "Calls" } }));
    expect(invalidate).toHaveBeenCalled();
  });
});
