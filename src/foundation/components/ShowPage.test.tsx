import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./Table", () => ({
  DeleteAction: () => null,
  EditAction: () => null,
}));

import { ShowPage } from "./ShowPage";

describe("ShowPage.Section", () => {
  it("aligns section actions beside the title and description", () => {
    render(
      <ShowPage.Section
        title="Runtime Allocation"
        description="GPU placement details"
        actions={<span>2 replicas / 8 cards</span>}
      >
        <div>Allocation content</div>
      </ShowPage.Section>,
    );

    expect(
      screen.getByRole("heading", { name: "Runtime Allocation" }),
    ).toBeTruthy();
    expect(screen.getByText("GPU placement details")).toBeTruthy();
    expect(screen.getByText("2 replicas / 8 cards")).toBeTruthy();
    expect(screen.getByText("Allocation content")).toBeTruthy();
  });
});
