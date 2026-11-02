import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Disclosure } from "./Disclosure";

describe("Disclosure", () => {
  it("uses one trigger for the title and chevron", () => {
    render(
      <Disclosure title="Details" summary="Read-only summary" testId="details">
        <p>Expanded content</p>
      </Disclosure>,
    );

    expect(screen.getByTestId("details").getAttribute("data-variant")).toBe(
      "card",
    );
    const trigger = screen.getByRole("button", {
      name: /Details.*Read-only summary/,
    });
    expect(screen.queryByText("Expanded content")).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByText("Expanded content")).toBeTruthy();
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

    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Provider" })).toBeTruthy();
  });
});
