import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

const deleteButton = () =>
  screen.getByRole("button", { name: /buttons.delete/ });

describe("DeleteConfirmDialog", () => {
  it("keeps the default dialog unchanged", () => {
    render(<DeleteConfirmDialog open onConfirm={() => {}} />);
    screen.getByText("dialogs.delete.description");
    screen.getByText("dialogs.delete.forceDelete.label");
    expect(screen.queryByTestId("delete-confirm-name")).toBeNull();
    expect(deleteButton().hasAttribute("disabled")).toBe(false);
  });

  it("enables Delete only after the exact name is typed", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmDialog
        open
        description="impact"
        confirmName="my-sink"
        allowForceDelete={false}
        onConfirm={onConfirm}
      />,
    );
    screen.getByText("impact");
    expect(screen.queryByText("dialogs.delete.forceDelete.label")).toBeNull();
    expect(deleteButton().hasAttribute("disabled")).toBe(true);

    const input = screen.getByTestId("delete-confirm-name");
    fireEvent.change(input, { target: { value: "my-sin" } });
    expect(deleteButton().hasAttribute("disabled")).toBe(true);

    fireEvent.change(input, { target: { value: "my-sink" } });
    expect(deleteButton().hasAttribute("disabled")).toBe(false);
    fireEvent.click(deleteButton());
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("takes a custom label, extra content and a disabled state", () => {
    render(
      <DeleteConfirmDialog
        open
        allowForceDelete={false}
        okText="remove"
        okDisabled
        extraContent={<p>checking</p>}
        onConfirm={() => {}}
      />,
    );
    screen.getByText("checking");
    expect(
      screen.getByRole("button", { name: /remove/ }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
