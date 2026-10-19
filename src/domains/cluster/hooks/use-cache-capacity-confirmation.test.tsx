import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCacheCapacityConfirmation } from "./use-cache-capacity-confirmation";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
function Harness({
  before,
  after,
  save,
}: {
  before?: { enabled: boolean; l1_size_gib: number };
  after: { enabled: boolean; l1_size_gib: number };
  save: () => void;
}) {
  const { confirmCapacity, capacityConfirmation } =
    useCacheCapacityConfirmation();
  return (
    <>
      <button
        type="button"
        onClick={() => confirmCapacity(before, after, save)}
      >
        save
      </button>
      {capacityConfirmation}
    </>
  );
}
describe("capacity change confirmation", () => {
  it("cancel does not submit; confirm submits exactly once", () => {
    const save = vi.fn();
    render(
      <Harness
        before={{ enabled: true, l1_size_gib: 2 }}
        after={{ enabled: true, l1_size_gib: 3 }}
        save={save}
      />,
    );
    fireEvent.click(screen.getByText("save"));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("buttons.cancel"));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("save"));
    fireEvent.click(screen.getByText("clusters.zcache.confirmSave"));
    expect(save).toHaveBeenCalledTimes(1);
  });
  it.each([
    [undefined, { enabled: true, l1_size_gib: 3 }],
    [
      { enabled: false, l1_size_gib: 2 },
      { enabled: true, l1_size_gib: 3 },
    ],
    [
      { enabled: true, l1_size_gib: 2 },
      { enabled: true, l1_size_gib: 2 },
    ],
    [
      { enabled: true, l1_size_gib: 2 },
      { enabled: false, l1_size_gib: 3 },
    ],
  ])(
    "does not confirm initial, unchanged or disabled capacity",
    (before, after) => {
      const save = vi.fn();
      render(<Harness before={before} after={after!} save={save} />);
      fireEvent.click(screen.getByText("save"));
      expect(save).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );
});
