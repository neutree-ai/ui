import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import JSONSchemaVisualizer from "./JsonSchemaVisualizer";

describe("JSONSchemaVisualizer", () => {
  it.each([null, undefined])(
    "shows an empty state for a %s schema",
    (schema) => {
      render(<JSONSchemaVisualizer schema={schema} />);

      expect(
        screen.getByText("This version declares no values schema."),
      ).toBeTruthy();
    },
  );

  it("renders the schema's properties", () => {
    render(
      <JSONSchemaVisualizer
        schema={{
          title: "Engine values",
          type: "object",
          properties: { gpu_memory_utilization: { type: "number" } },
        }}
      />,
    );

    expect(screen.getByText("Engine values")).toBeTruthy();
    expect(screen.getByText("gpu_memory_utilization")).toBeTruthy();
    expect(
      screen.queryByText("This version declares no values schema."),
    ).toBeNull();
  });
});
