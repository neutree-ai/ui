import { renderHook, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { useIsTruncated } from "./use-is-truncated";

function elementWithBox(
  scrollWidth: number,
  clientWidth: number,
  scrollHeight = 20,
  clientHeight = 20,
) {
  const element = document.createElement("span");
  Object.defineProperty(element, "scrollWidth", { value: scrollWidth });
  Object.defineProperty(element, "clientWidth", { value: clientWidth });
  Object.defineProperty(element, "scrollHeight", { value: scrollHeight });
  Object.defineProperty(element, "clientHeight", { value: clientHeight });
  return element;
}

describe("useIsTruncated", () => {
  it("reports an element that clips its content", async () => {
    const ref = createRef<HTMLElement>();
    // @ts-expect-error the ref is attached before render in this test
    ref.current = elementWithBox(320, 180);

    const { result } = renderHook(() => useIsTruncated(ref));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("reports an element that fits", async () => {
    const ref = createRef<HTMLElement>();
    // @ts-expect-error the ref is attached before render in this test
    ref.current = elementWithBox(180, 180);

    const { result } = renderHook(() => useIsTruncated(ref));

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("reports an element whose content is clamped vertically", async () => {
    const ref = createRef<HTMLElement>();
    // @ts-expect-error the ref is attached before render in this test
    ref.current = elementWithBox(180, 180, 60, 40);

    const { result } = renderHook(() => useIsTruncated(ref));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays false without an element", async () => {
    const ref = createRef<HTMLElement>();

    const { result } = renderHook(() => useIsTruncated(ref));

    await waitFor(() => expect(result.current).toBe(false));
  });
});
