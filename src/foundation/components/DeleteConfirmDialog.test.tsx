import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

const deleteButton = () =>
  screen.getByRole("button", { name: /buttons.delete/ });

describe("DeleteConfirmDialog", () => {
  it("keeps the default dialog unchanged", () => {
    render(<DeleteConfirmDialog open onConfirm={() => {}} />);
    expect(screen.getByText("dialogs.delete.description")).toBeTruthy();
    expect(screen.getByText("dialogs.delete.forceDelete.label")).toBeTruthy();
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
    expect(screen.getByText("impact")).toBeTruthy();
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
});
