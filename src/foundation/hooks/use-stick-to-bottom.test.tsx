import { act, render } from "@testing-library/react";
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
  scrollTop: () => number;
  userScrollsTo: (value: number) => void;
  scrollToCalls: Array<{ top: number; behavior?: ScrollBehavior }>;
};

function makeScrollable(
  element: HTMLDivElement,
  clientHeight: number,
  scrollHeight: number,
): Scroller {
  let top = 0;
  let height = scrollHeight;
  const maxTop = () => Math.max(0, height - clientHeight);
  const scrollToCalls: Array<{ top: number; behavior?: ScrollBehavior }> = [];

  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.min(Math.max(0, value), maxTop());
    },
  });
  element.scrollTo = ((options: ScrollToOptions) => {
    scrollToCalls.push({ top: options.top ?? 0, behavior: options.behavior });
    top = Math.min(Math.max(0, options.top ?? 0), maxTop());
  }) as typeof element.scrollTo;

  return {
    element,
    setScrollHeight: (value: number) => {
      height = value;
    },
    scrollTop: () => top,
    userScrollsTo: (value: number) => {
      top = Math.min(Math.max(0, value), maxTop());
      element.dispatchEvent(new Event("scroll"));
    },
    scrollToCalls,
  };
}

function Harness({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useStickToBottom>) => void;
}) {
  const stick = useStickToBottom();
  onReady(stick);
  return (
    <div
      ref={stick.scrollRef}
      data-testid="scroller"
      data-at-bottom={String(stick.isAtBottom)}
    >
      <div ref={stick.contentRef} data-testid="content" />
    </div>
  );
}

function renderHarness() {
  let api: ReturnType<typeof useStickToBottom> | null = null;
  render(<Harness onReady={(value) => (api = value)} />);
  const scrollerElement = document.querySelector<HTMLDivElement>(
    "[data-testid=scroller]",
  );
  if (!scrollerElement || !api) throw new Error("harness did not render");
  // Read the state off the DOM: `api` is the first render's snapshot, and the
  // hook returns a fresh object each render.
  const scrollerApi = api as ReturnType<typeof useStickToBottom>;
  return {
    api: scrollerApi,
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
    const { scrollerElement } = renderHarness();
    const scroller = makeScrollable(scrollerElement, 400, 1000);

    contentGrows();

    expect(scroller.scrollTop()).toBe(600);
  });

  it("follows content that grows while the reader is at the bottom", () => {
    const { scrollerElement } = renderHarness();
    const scroller = makeScrollable(scrollerElement, 400, 1000);
    contentGrows();

    scroller.setScrollHeight(1600);
    contentGrows();

    expect(scroller.scrollTop()).toBe(1200);
  });

  it("stops following once the reader scrolls up, and does not drag them back", () => {
    const { isAtBottom, scrollerElement } = renderHarness();
    const scroller = makeScrollable(scrollerElement, 400, 1000);
    contentGrows();

    act(() => scroller.userScrollsTo(200));
    expect(isAtBottom()).toBe(false);

    scroller.setScrollHeight(1800);
    contentGrows();

    expect(scroller.scrollTop()).toBe(200);
  });

  it("resumes following when the reader returns to the bottom", () => {
    const { isAtBottom, scrollerElement } = renderHarness();
    const scroller = makeScrollable(scrollerElement, 400, 1000);
    contentGrows();
    act(() => scroller.userScrollsTo(200));

    act(() => scroller.userScrollsTo(600));

    expect(isAtBottom()).toBe(true);
    scroller.setScrollHeight(2000);
    contentGrows();
    expect(scroller.scrollTop()).toBe(1600);
  });

  it("follows the bottom again when the reader sends a message", () => {
    const { api, isAtBottom, scrollerElement } = renderHarness();
    const scroller = makeScrollable(scrollerElement, 400, 1000);
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
    makeScrollable(scrollerElement, 400, 1000);
    contentGrows();

    // The browser delivers the scroll our pin caused, after the fact.
    act(() => {
      scrollerElement.dispatchEvent(new Event("scroll"));
    });

    expect(isAtBottom()).toBe(true);
  });

  it("ignores the intermediate positions of a smooth scroll", () => {
    const { api, isAtBottom, scrollerElement } = renderHarness();
    const scroller = makeScrollable(scrollerElement, 400, 1000);
    contentGrows();
    act(() => scroller.userScrollsTo(100));

    act(() => api.scrollToBottom("smooth"));
    // The animation travels back down; those events are the browser's, not the
    // reader's, and must not switch following off mid-flight.
    act(() => scrollerElement.dispatchEvent(new Event("scroll")));

    expect(isAtBottom()).toBe(true);
  });

  it("gives the reader control if they scroll up during a smooth scroll", () => {
    const { api, isAtBottom, scrollerElement } = renderHarness();
    const scroller = makeScrollable(scrollerElement, 400, 1000);
    contentGrows();
    act(() => scroller.userScrollsTo(100));

    act(() => api.scrollToBottom("smooth"));
    act(() => scroller.userScrollsTo(50));

    expect(isAtBottom()).toBe(false);
  });
});
