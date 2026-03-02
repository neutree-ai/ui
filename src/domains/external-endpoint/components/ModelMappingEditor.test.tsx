import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import ModelMappingEditor from "./ModelMappingEditor";

describe("ModelMappingEditor", () => {
  it("renders one empty row by default", () => {
    render(<ModelMappingEditor />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2); // key + value
    expect((inputs[0] as HTMLInputElement).value).toBe("");
    expect((inputs[1] as HTMLInputElement).value).toBe("");
  });

  it("renders rows from initial value", () => {
    render(
      <ModelMappingEditor value={{ "gpt-4o": "gpt-4o", claude: "claude-3" }} />,
    );
    const inputs = screen.getAllByRole("textbox");
    // 2 entries × 2 fields = 4 inputs
    expect(inputs).toHaveLength(4);
    expect((inputs[0] as HTMLInputElement).value).toBe("gpt-4o");
    expect((inputs[1] as HTMLInputElement).value).toBe("gpt-4o");
    expect((inputs[2] as HTMLInputElement).value).toBe("claude");
    expect((inputs[3] as HTMLInputElement).value).toBe("claude-3");
  });

  it("adds a new row when add button is clicked", () => {
    const onChange = vi.fn();
    render(<ModelMappingEditor value={{ a: "b" }} onChange={onChange} />);

    fireEvent.click(
      screen.getByText("external_endpoints.actions.addModelMapping"),
    );

    const inputs = screen.getAllByRole("textbox");
    // 1 existing + 1 new = 4 inputs
    expect(inputs).toHaveLength(4);
  });

  it("calls onChange with updated record when key is typed", () => {
    const onChange = vi.fn();
    render(<ModelMappingEditor onChange={onChange} />);

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "my-model" } });
    fireEvent.change(inputs[1], { target: { value: "upstream-model" } });

    expect(onChange).toHaveBeenLastCalledWith({
      "my-model": "upstream-model",
    });
  });

  it("filters out rows with empty keys in onChange output", () => {
    const onChange = vi.fn();
    render(
      <ModelMappingEditor value={{ existing: "val" }} onChange={onChange} />,
    );

    // Add a new row (empty key)
    fireEvent.click(
      screen.getByText("external_endpoints.actions.addModelMapping"),
    );

    // onChange should only include the row with a non-empty key
    expect(onChange).toHaveBeenLastCalledWith({ existing: "val" });
  });

  it("removes a row when remove button is clicked", () => {
    const onChange = vi.fn();
    render(
      <ModelMappingEditor
        value={{ "model-a": "a", "model-b": "b" }}
        onChange={onChange}
      />,
    );

    // Find all trash buttons — there should be 2 (one per row)
    const removeButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.querySelector(".lucide-trash-2") !== null);
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[0]);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2); // 1 remaining row
    expect(onChange).toHaveBeenLastCalledWith({ "model-b": "b" });
  });

  it("prevents removing the last row", () => {
    render(<ModelMappingEditor />);
    const removeButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.querySelector(".lucide-trash-2") !== null);
    expect(removeButtons).toHaveLength(1);
    expect((removeButtons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables all inputs when disabled prop is true", () => {
    render(<ModelMappingEditor value={{ a: "b" }} disabled />);
    const inputs = screen.getAllByRole("textbox");
    for (const input of inputs) {
      expect((input as HTMLInputElement).disabled).toBe(true);
    }
  });
});
