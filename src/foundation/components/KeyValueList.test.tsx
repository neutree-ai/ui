import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KeyValueList } from "./KeyValueList";

describe("KeyValueList", () => {
  it("renders empty, primitive, object, and unserializable values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    render(
      <KeyValueList
        entries={[
          ["missing", undefined],
          ["nothing", null],
          ["enabled", true],
          ["options", { nested: true }],
          ["circular", circular],
        ]}
      />,
    );

    expect(screen.getByText("missing").parentElement?.textContent).toBe(
      "missing: ",
    );
    expect(screen.getByText("nothing").parentElement?.textContent).toBe(
      "nothing: ",
    );
    expect(screen.getByText("options").parentElement?.textContent).toBe(
      'options: {"nested":true}',
    );
    expect(screen.getByText("circular").parentElement?.textContent).toBe(
      "circular: [object Object]",
    );
  });
});
