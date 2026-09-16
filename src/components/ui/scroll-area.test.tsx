import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea } from "@/components/ui/scroll-area";

describe("ScrollArea", () => {
  it("hands the caller the element that scrolls, not the frame around it", () => {
    let viewport: HTMLDivElement | null = null;

    render(
      <ScrollArea viewportRef={(node) => (viewport = node)}>
        <p>content</p>
      </ScrollArea>,
    );

    // Radix puts the overflow on an inner viewport, so following the end of a
    // conversation means reaching this element rather than the root.
    expect(viewport).not.toBeNull();
    expect((viewport as unknown as HTMLDivElement).dataset.radixScrollAreaViewport).toBe("");
    expect(screen.getByText("content").closest("[data-radix-scroll-area-viewport]")).toBe(
      viewport,
    );
  });

  it("still renders without the optional viewport ref", () => {
    render(
      <ScrollArea>
        <p>content</p>
      </ScrollArea>,
    );

    expect(screen.getByText("content")).toBeDefined();
  });
});
