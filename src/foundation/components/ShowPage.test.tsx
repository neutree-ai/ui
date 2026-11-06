import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";

vi.mock("./Table", () => ({
  DeleteAction: () => null,
  EditAction: () => null,
}));

import { ShowPage } from "./ShowPage";

describe("ShowPage.Section", () => {
  it("renders the title, description, actions and content", () => {
    render(
      <ShowPage.Section
        title="Runtime Allocation"
        description="GPU placement details"
        actions={<span>2 replicas / 8 cards</span>}
      >
        <div>Allocation content</div>
      </ShowPage.Section>,
    );

    screen.getByRole("heading", { name: "Runtime Allocation" });
    screen.getByText("GPU placement details");
    screen.getByText("2 replicas / 8 cards");
    screen.getByText("Allocation content");
  });
});
