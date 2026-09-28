import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsTruncated } from "./use-is-truncated";

const elementWith = ({
  scrollWidth,
  clientWidth,
  scrollHeight = 10,
  clientHeight = 10,
}: {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight?: number;
  clientHeight?: number;
}) => {
  const element = document.createElement("span");
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
    scrollHeight: { configurable: true, value: scrollHeight },
    clientHeight: { configurable: true, value: clientHeight },
  });
  return element;
};

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe = (element: Element) => {
    this.observed.push(element);
  };
  disconnect = () => {
    this.disconnected = true;
  };
  fire() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

const withResizeObserver = () => {
  FakeResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useIsTruncated", () => {
  it("reports nothing while the caller has no element", () => {
    withResizeObserver();

    const { result } = renderHook(() => useIsTruncated({ current: null }));

    expect(result.current).toBe(false);
    expect(FakeResizeObserver.instances).toHaveLength(0);
  });

  it("reports a clipped element on either axis", () => {
    withResizeObserver();

    const horizontally = renderHook(() =>
      useIsTruncated({
        current: elementWith({ scrollWidth: 200, clientWidth: 100 }),
      }),
    );
    expect(horizontally.result.current).toBe(true);

    const vertically = renderHook(() =>
      useIsTruncated({
        current: elementWith({
          scrollWidth: 100,
          clientWidth: 100,
          scrollHeight: 40,
          clientHeight: 20,
        }),
      }),
    );
    expect(vertically.result.current).toBe(true);

    const fitting = renderHook(() =>
      useIsTruncated({
        current: elementWith({ scrollWidth: 100, clientWidth: 100 }),
      }),
    );
    expect(fitting.result.current).toBe(false);
  });

  it("re-measures when the element it was handed resizes", () => {
    withResizeObserver();
    const element = elementWith({ scrollWidth: 100, clientWidth: 100 });

    const { result } = renderHook(() => useIsTruncated({ current: element }));
    expect(result.current).toBe(false);

    const observer = FakeResizeObserver.instances.at(-1);
    if (!observer) throw new Error("the hook did not observe anything");
    expect(observer.observed).toContain(element);

    Object.defineProperty(element, "scrollWidth", {
      configurable: true,
      value: 300,
    });
    act(() => {
      observer.fire();
    });

    expect(result.current).toBe(true);
  });

  // A caller is allowed to move the element when the answer changes — wrapping
  // a clipped name in its tooltip, say — which remounts it. The observer has to
  // follow: one left on the node that was replaced keeps reporting a detached
  // element's 0x0 box, which reads as "fits" and flips the answer straight back.
  it("follows the element to the node it is re-rendered as", () => {
    withResizeObserver();
    const first = elementWith({ scrollWidth: 300, clientWidth: 100 });
    const replacement = elementWith({ scrollWidth: 100, clientWidth: 100 });
    const ref = { current: first as HTMLElement | null };

    const { result, rerender } = renderHook(() => useIsTruncated(ref));
    expect(result.current).toBe(true);

    ref.current = replacement;
    rerender();

    expect(result.current).toBe(false);
    expect(FakeResizeObserver.instances.at(-1)?.observed).toContain(
      replacement,
    );
  });

  it("still measures where ResizeObserver does not exist", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    const { result } = renderHook(() =>
      useIsTruncated({
        current: elementWith({ scrollWidth: 300, clientWidth: 100 }),
      }),
    );

    expect(result.current).toBe(true);
  });
});
