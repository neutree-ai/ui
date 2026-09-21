import { renderHook, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { useIsTruncated } from "./use-is-truncated";

function elementWithWidths(scrollWidth: number, clientWidth: number) {
  const element = document.createElement("span");
  Object.defineProperty(element, "scrollWidth", { value: scrollWidth });
  Object.defineProperty(element, "clientWidth", { value: clientWidth });
  return element;
}

describe("useIsTruncated", () => {
  it("reports an element that clips its content", async () => {
    const ref = createRef<HTMLElement>();
    // @ts-expect-error the ref is attached before render in this test
    ref.current = elementWithWidths(320, 180);

    const { result } = renderHook(() => useIsTruncated(ref));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("reports an element that fits", async () => {
    const ref = createRef<HTMLElement>();
    // @ts-expect-error the ref is attached before render in this test
    ref.current = elementWithWidths(180, 180);

    const { result } = renderHook(() => useIsTruncated(ref));

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("stays false without an element", async () => {
    const ref = createRef<HTMLElement>();

    const { result } = renderHook(() => useIsTruncated(ref));

    await waitFor(() => expect(result.current).toBe(false));
  });
});
