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

  it("frames itself with the shared card surface rather than its own", () => {
    const { container } = render(
      <ShowPage.Section title="Nodes">
        <div>Node content</div>
      </ShowPage.Section>,
    );

    // A section and a Card routinely sit next to each other on a detail page,
    // so the section must not carry a second surface definition. Restating
    // radius here is what put them 4px apart.
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).toContain("rounded-[var(--nt-radius-card)]");
    expect(frame.className).not.toContain("rounded-lg");
  });

  it("drops the frame entirely when unframed", () => {
    const { container } = render(
      <ShowPage.Section framed={false} title="Nodes">
        <div>Node content</div>
      </ShowPage.Section>,
    );

    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).not.toContain("rounded-[var(--nt-radius-card)]");
    expect(frame.className).toContain("bg-transparent");
  });
});
