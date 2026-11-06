import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Disclosure } from "./Disclosure";

describe("Disclosure", () => {
  it("uses one trigger for the title and chevron", () => {
    render(
      <Disclosure title="Details" summary="Read-only summary">
        <p>Expanded content</p>
      </Disclosure>,
    );

    const trigger = screen.getByRole("button", {
      name: /Details.*Read-only summary/,
    });
    expect(screen.queryByText("Expanded content")).toBeNull();

    fireEvent.click(trigger);
    screen.getByText("Expanded content");
  });

  it("keeps independent actions outside the disclosure trigger", () => {
    render(
      <Disclosure
        title="Provider"
        actions={<button type="button">Remove</button>}
      >
        Provider fields
      </Disclosure>,
    );

    screen.getByRole("button", { name: "Remove" });
    screen.getByRole("button", { name: "Provider" });
  });
});
