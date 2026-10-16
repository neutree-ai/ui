import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStickToBottom } from "@/foundation/hooks/use-stick-to-bottom";

/**
 * jsdom has no layout: scrollHeight, clientHeight and scroll events do not
 * exist, and neither does ResizeObserver. The hook is a state machine over
 * exactly those, so the test supplies them — a container that clamps its
 * scrollTop the way a browser does, scroll events the test fires when it
 * chooses, and an observer it can trigger by hand.
 */

type Observer = { callback: ResizeObserverCallback; targets: Element[] };
let observers: Observer[] = [];

class FakeResizeObserver {
  callback: ResizeObserverCallback;
  targets: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }

  observe(target: Element) {
    this.targets.push(target);
  }

  unobserve() {}
  disconnect() {}
}

type Scroller = {
  element: HTMLDivElement;
  setScrollHeight: (value: number) => void;
  resizeBox: (width: number, height: number) => void;
  scrollTop: () => number;
  userScrollsTo: (value: number) => void;
  browserScrollsTo: (value: number) => void;
  scrollToCalls: Array<{ top: number; behavior?: ScrollBehavior }>;
};

/** The container's own box, which only a resize can change. */
type Box = { width: number; height: number };

function installBox(element: HTMLDivElement, box: Box) {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    get: () => box.width,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => box.height,
  });
}

function makeScrollable(
  element: HTMLDivElement,
  box: Box,
  scrollHeight: number,
): Scroller {
  let top = 0;
  let height = scrollHeight;
  const maxTop = () => Math.max(0, height - box.height);
  const scrollToCalls: Array<{ top: number; behavior?: ScrollBehavior }> = [];

  installBox(element, box);
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      const next = Math.min(Math.max(0, value), maxTop());
      if (next === top) return;
      top = next;
      // A real scroll container reports a programmatic scroll position too —
      // with the same event a wheel produces.
      element.dispatchEvent(new Event("scroll"));
    },
  });
  element.scrollTo = ((options: ScrollToOptions) => {
    scrollToCalls.push({ top: options.top ?? 0, behavior: options.behavior });
    // A smooth scroll does not arrive here: it travels over several frames,
    // which the test drives through `userScrollsTo`. Instant pins assign
    // scrollTop directly and never call this.
  }) as typeof element.scrollTo;

  const moveTo = (value: number) => {
    top = Math.min(Math.max(0, value), maxTop());
    element.dispatchEvent(new Event("scroll"));
  };

  return {
    element,
    setScrollHeight: (value: number) => {
      height = value;
    },
    resizeBox: (width: number, nextHeight: number) => {
      box.width = width;
      box.height = nextHeight;
    },
    scrollTop: () => top,
    userScrollsTo: moveTo,
    // A reflow moves the view too — scroll anchoring parks it where the reader
    // was reading — and the browser reports that as the same kind of event. The
    // hook cannot tell the two apart from the event, which is the point.
    browserScrollsTo: moveTo,
    scrollToCalls,
  };
}

function Harness({
  onReady,
  box,
}: {
  onReady: (api: ReturnType<typeof useStickToBottom>) => void;
  box: Box;
}) {
  const stick = useStickToBottom();
  onReady(stick);
  return (
    <div
      ref={(node) => {
        // A real container is already laid out when the hook's effects run, so
        // the fake box has to be in place at the same moment — a ref, not the
        // test body, which runs after them.
        if (node) installBox(node, box);
        stick.scrollRef.current = node;
      }}
      data-testid="scroller"
      data-at-bottom={String(stick.isAtBottom)}
    >
      <div ref={stick.contentRef} data-testid="content" />
    </div>
  );
}

function renderHarness(
  box: Box = { width: 800, height: 400 },
  scrollHeight = 1000,
) {
  let api: ReturnType<typeof useStickToBottom> | null = null;
  render(<Harness box={box} onReady={(value) => (api = value)} />);
  const scrollerElement = document.querySelector<HTMLDivElement>(
    "[data-testid=scroller]",
  );
  if (!scrollerElement || !api) throw new Error("harness did not render");
  const scroller = makeScrollable(scrollerElement, box, scrollHeight);
  // Read the state off the DOM: `api` is the first render's snapshot, and the
  // hook returns a fresh object each render.
  const scrollerApi = api as ReturnType<typeof useStickToBottom>;
  return {
    api: scrollerApi,
    scroller,
    box,
    isAtBottom: () => scrollerElement.dataset.atBottom === "true",
    scrollerElement,
  };
}

/** The observer fires whenever content grows — streamed text, settled markdown. */
function contentGrows() {
  act(() => {
    for (const observer of observers) {
      observer.callback([], observer as unknown as ResizeObserver);
    }
  });
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useStickToBottom", () => {
  it("opens at the latest content", () => {
    const { scroller } = renderHarness();

    contentGrows();

    expect(scroller.scrollTop()).toBe(600);
  });

  it("follows content that grows while the reader is at the bottom", () => {
    const { scroller } = renderHarness();
    contentGrows();

    scroller.setScrollHeight(1600);
    contentGrows();

    expect(scroller.scrollTop()).toBe(1200);
  });

  it("stops following once the reader scrolls up, and does not drag them back", () => {
    const { isAtBottom, scroller } = renderHarness();
    contentGrows();

    act(() => scroller.userScrollsTo(200));
    expect(isAtBottom()).toBe(false);

    scroller.setScrollHeight(1800);
    contentGrows();

    expect(scroller.scrollTop()).toBe(200);
  });

  it("resumes following when the reader returns to the bottom", () => {
    const { isAtBottom, scroller } = renderHarness();
    contentGrows();
    act(() => scroller.userScrollsTo(200));

    act(() => scroller.userScrollsTo(600));

    expect(isAtBottom()).toBe(true);
    scroller.setScrollHeight(2000);
    contentGrows();
    expect(scroller.scrollTop()).toBe(1600);
  });

  it("follows the bottom again when the reader sends a message", () => {
    const { api, isAtBottom, scroller } = renderHarness();
    contentGrows();
    act(() => scroller.userScrollsTo(200));

    act(() => api.scrollToBottom());

    expect(scroller.scrollTop()).toBe(600);
    expect(isAtBottom()).toBe(true);
    scroller.setScrollHeight(1200);
    contentGrows();
    expect(scroller.scrollTop()).toBe(800);
  });

  it("does not mistake its own scroll for the reader scrolling away", () => {
    const { isAtBottom, scrollerElement } = renderHarness();
    contentGrows();

    // The browser delivers the scroll our pin caused, after the fact.
    act(() => {
      scrollerElement.dispatchEvent(new Event("scroll"));
    });

    expect(isAtBottom()).toBe(true);
  });

  it("keeps following when a resize parks the view mid-conversation", () => {
    const { isAtBottom, scroller } = renderHarness();
    contentGrows();
    expect(scroller.scrollTop()).toBe(600);

    // The window narrows. The transcript re-wraps into one four times as tall,
    // and scroll anchoring answers by holding the paragraph that was on screen
    // rather than leaving the view at the end — the scroll that reports that
    // arrives before the observer callback carrying the new size, so judging
    // it as the reader's own leaves the newest turn off screen for good.
    scroller.resizeBox(600, 300);
    scroller.setScrollHeight(2400);
    act(() => scroller.browserScrollsTo(1500));

    expect(scroller.scrollTop()).toBe(2100);
    expect(isAtBottom()).toBe(true);

    // And the following survives the resize: the next growth is followed too.
    scroller.setScrollHeight(3000);
    contentGrows();
    expect(scroller.scrollTop()).toBe(2700);
  });

  it("keeps following when a resize widens the container", () => {
    const { isAtBottom, scroller } = renderHarness(
      { width: 600, height: 300 },
      2400,
    );
    contentGrows();
    expect(scroller.scrollTop()).toBe(2100);

    // The other direction collapses the transcript instead of growing it, so
    // the position the layout leaves behind is *above* the end. Narrowing and
    // widening are the same event to the hook, and neither may stop the
    // following.
    scroller.resizeBox(900, 400);
    scroller.setScrollHeight(1400);
    act(() => scroller.browserScrollsTo(300));

    expect(scroller.scrollTop()).toBe(1000);
    expect(isAtBottom()).toBe(true);
  });

  it("stops following when the reader scrolls away after a resize", () => {
    const { isAtBottom, scroller } = renderHarness();
    contentGrows();

    scroller.resizeBox(600, 300);
    scroller.setScrollHeight(2400);
    act(() => scroller.browserScrollsTo(1500));

    // Put back at the end by the resize, the reader now takes over: the
    // container is not being resized any more, so this is their intent.
    act(() => scroller.userScrollsTo(900));

    expect(isAtBottom()).toBe(false);
    scroller.setScrollHeight(3000);
    contentGrows();
    expect(scroller.scrollTop()).toBe(900);
  });

  it("ignores the intermediate positions of a smooth scroll", () => {
    const { api, isAtBottom, scroller } = renderHarness();
    contentGrows();
    act(() => scroller.userScrollsTo(100));

    act(() => api.scrollToBottom("smooth"));
    // The animation travels back down; those events are the browser's, not the
    // reader's, and must not switch following off mid-flight.
    act(() => scroller.userScrollsTo(300));
    expect(isAtBottom()).toBe(true);
    expect(scroller.scrollToCalls).toHaveLength(1);

    act(() => scroller.userScrollsTo(600));
    expect(isAtBottom()).toBe(true);
  });

  it("gives the reader control if they scroll up during a smooth scroll", () => {
    const { api, isAtBottom, scroller } = renderHarness();
    contentGrows();
    act(() => scroller.userScrollsTo(100));

    act(() => api.scrollToBottom("smooth"));
    act(() => scroller.userScrollsTo(50));

    expect(isAtBottom()).toBe(false);
  });

  it("does nothing when there is no scroll container", () => {
    const WithoutRefs = () => {
      const stick = useStickToBottom();
      return (
        <div data-at-bottom={String(stick.isAtBottom)}>
          <button type="button" onClick={() => stick.scrollToBottom()}>
            latest
          </button>
        </div>
      );
    };

    // No ref is ever attached: the mount effects and the listeners have nothing
    // to work with, and neither an explicit jump nor a render may throw or
    // claim the reader left the bottom.
    render(<WithoutRefs />);
    fireEvent.click(screen.getByRole("button", { name: "latest" }));

    expect(
      document
        .querySelector("[data-at-bottom]")
        ?.getAttribute("data-at-bottom"),
    ).toBe("true");
  });

  it("still answers scrollToBottom where ResizeObserver does not exist", () => {
    vi.unstubAllGlobals();
    const { api, scroller } = renderHarness();

    act(() => api.scrollToBottom());

    expect(scroller.scrollTop()).toBe(600);
  });

  it("jumps instantly where the reader asked for less motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
    }));
    const { api, scroller } = renderHarness();
    contentGrows();
    act(() => scroller.userScrollsTo(100));

    act(() => api.scrollToBottom("smooth"));

    expect(scroller.scrollToCalls).toHaveLength(0);
    expect(scroller.scrollTop()).toBe(600);
  });

  it("animates where the reader has no motion preference", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
    }));
    const { api, scroller } = renderHarness();
    contentGrows();
    act(() => scroller.userScrollsTo(100));

    act(() => api.scrollToBottom("smooth"));

    expect(scroller.scrollToCalls).toHaveLength(1);
  });

  it("ignores a scroll from a container that has gone away", () => {
    let api: ReturnType<typeof useStickToBottom> | null = null;
    let detached: HTMLDivElement | null = null;

    const WithOptionalScroller = ({ show }: { show: boolean }) => {
      const stick = useStickToBottom();
      api = stick;
      return (
        <div>
          {show ? (
            <div
              data-testid="scroller"
              ref={(node) => {
                stick.scrollRef.current = node;
                // Keep the last real node: React calls this with null when the
                // element leaves, which is the moment under test.
                if (node) detached = node;
              }}
            />
          ) : null}
          <div ref={stick.contentRef} />
        </div>
      );
    };

    const { rerender } = render(<WithOptionalScroller show />);
    expect(api).not.toBeNull();

    // The transcript leaves the page; React clears the ref, and the listener
    // stays attached to the element that went with it.
    rerender(<WithOptionalScroller show={false} />);
    expect(() =>
      (detached as unknown as HTMLDivElement).dispatchEvent(
        new Event("scroll"),
      ),
    ).not.toThrow();
  });
});
