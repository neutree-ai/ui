import { describe, expect, it } from "vitest";
import {
  isScrolledToBottom,
  STICK_TO_BOTTOM_THRESHOLD_PX,
} from "@/foundation/lib/stick-to-bottom";

describe("isScrolledToBottom", () => {
  it("is true at the end of a scrollable container", () => {
    expect(
      isScrolledToBottom({
        scrollTop: 600,
        scrollHeight: 1000,
        clientHeight: 400,
      }),
    ).toBe(true);
  });

  it("is false when the reader is above the end", () => {
    expect(
      isScrolledToBottom({
        scrollTop: 420,
        scrollHeight: 1000,
        clientHeight: 400,
      }),
    ).toBe(false);
  });

  it("tolerates the few pixels a reader at the bottom usually sits off by", () => {
    const nearEnd = {
      scrollTop: 600 - STICK_TO_BOTTOM_THRESHOLD_PX + 1,
      scrollHeight: 1000,
      clientHeight: 400,
    };
    const beyondTolerance = {
      scrollTop: 600 - STICK_TO_BOTTOM_THRESHOLD_PX - 1,
      scrollHeight: 1000,
      clientHeight: 400,
    };

    expect(isScrolledToBottom(nearEnd)).toBe(true);
    expect(isScrolledToBottom(beyondTolerance)).toBe(false);
  });

  it("honours a caller-supplied tolerance", () => {
    const metrics = { scrollTop: 560, scrollHeight: 1000, clientHeight: 400 };

    expect(isScrolledToBottom(metrics, 0)).toBe(false);
    expect(isScrolledToBottom(metrics, 40)).toBe(true);
  });

  it("counts content that does not scroll as being at the bottom", () => {
    expect(
      isScrolledToBottom({
        scrollTop: 0,
        scrollHeight: 300,
        clientHeight: 400,
      }),
    ).toBe(true);
    expect(
      isScrolledToBottom({
        scrollTop: 0,
        scrollHeight: 400,
        clientHeight: 400,
      }),
    ).toBe(true);
  });

  it("stays at the bottom when the container is over-scrolled", () => {
    // Elastic overscroll (trackpad, iOS) reports scrollTop beyond the end.
    expect(
      isScrolledToBottom({
        scrollTop: 700,
        scrollHeight: 1000,
        clientHeight: 400,
      }),
    ).toBe(true);
  });
});
