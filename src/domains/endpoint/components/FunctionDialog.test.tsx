import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `t` has to keep its identity across renders: FunctionDialog's schema effect
// depends on it, and a fresh function per render would loop forever.
vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("@/foundation/lib/i18n", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

import { FunctionDialog } from "./FunctionDialog";

describe("FunctionDialog", () => {
  it("submits from the button, never on Enter inside a field", async () => {
    const onSave = vi.fn();
    render(<FunctionDialog open onOpenChange={vi.fn()} onSave={onSave} />);

    const name = screen.getByPlaceholderText(
      "components.playground.chat.functionNamePlaceholder",
    );
    fireEvent.change(name, { target: { value: "get_weather" } });

    // The dialog has three options, so the field's Enter is refused and the
    // button below is the only submit path.
    expect(fireEvent.keyDown(name, { key: "Enter" })).toBe(false);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "buttons.add" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: "get_weather" }),
      );
    });
  });
});
