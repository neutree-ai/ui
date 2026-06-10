import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared spies/handles between the react-window mock and the test body.
const h = vi.hoisted(() => ({
  scrollToItem: vi.fn(),
  onScroll: { current: null as null | ((p: unknown) => void) },
}));

// Mock react-window's FixedSizeList with a minimal class component so we can
// (a) capture the imperative `scrollToItem` call the component makes through
// the ref, and (b) drive `onScroll` manually to simulate user scrolling.
vi.mock("react-window", async () => {
  const React = await import("react");
  class List extends React.Component<{ onScroll?: (p: unknown) => void }> {
    scrollToItem = h.scrollToItem;
    render() {
      h.onScroll.current = this.props.onScroll ?? null;
      return null;
    }
  }
  return { FixedSizeList: List };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

import { VirtualLog } from "./VirtualLog";

const makeLog = (n: number) =>
  Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

// Simulate a real (non-programmatic) user scroll to a given offset.
const userScrollTo = (scrollOffset: number) =>
  h.onScroll.current?.({
    scrollDirection: "backward",
    scrollOffset,
    scrollUpdateWasRequested: false,
  });

describe("VirtualLog tail-following", () => {
  beforeEach(() => {
    h.scrollToItem.mockClear();
  });

  it("auto-scrolls to the latest line on initial render", () => {
    render(<VirtualLog log={makeLog(3)} />);
    expect(h.scrollToItem).toHaveBeenCalledWith(2, "end");
  });

  it("stops following the tail once the user scrolls up", () => {
    // Enough lines that the content is taller than the viewport, otherwise
    // every offset counts as "at bottom".
    const { rerender } = render(<VirtualLog log={makeLog(100)} />);
    h.scrollToItem.mockClear();

    // User scrolls up to inspect earlier output.
    userScrollTo(0);

    // Auto-refresh delivers new lines.
    rerender(<VirtualLog log={makeLog(105)} />);

    expect(h.scrollToItem).not.toHaveBeenCalled();
  });

  it("keeps following the tail while the user is pinned to the bottom", () => {
    const { rerender } = render(<VirtualLog log={makeLog(100)} />);
    h.scrollToItem.mockClear();

    // User is at the bottom (large offset clamps to the tail).
    userScrollTo(1_000_000);

    // Auto-refresh delivers new lines.
    rerender(<VirtualLog log={makeLog(105)} />);

    expect(h.scrollToItem).toHaveBeenCalledWith(104, "end");
  });

  it("auto-scrolls to the tail when switching from reverse back to normal order", () => {
    // Start in reverse order, where the latest line is at the top.
    const { rerender } = render(<VirtualLog log={makeLog(100)} reverse />);
    h.scrollToItem.mockClear();

    // The user scrolls within reverse mode. This must NOT clobber the
    // pinned-to-bottom state, which is only meaningful in normal order.
    userScrollTo(0);

    // Switch back to normal order: we expect to jump to the latest line,
    // matching the previous unconditional behavior.
    rerender(<VirtualLog log={makeLog(100)} reverse={false} />);

    expect(h.scrollToItem).toHaveBeenCalledWith(99, "end");
  });
});
