import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCopyToClipboard = vi.hoisted(() => vi.fn());

vi.mock("@/foundation/lib/clipboard", () => ({
  copyToClipboard: mockCopyToClipboard,
}));

import { useCopyToClipboard } from "./use-copy-to-clipboard";

const options = {
  successMessage: "Copied!",
  errorMessage: "Failed!",
};

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with copied = false", () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);
  });

  it("sets copied to true on success and resets after timeout", async () => {
    mockCopyToClipboard.mockResolvedValueOnce(true);
    const { result } = renderHook(() => useCopyToClipboard(1000));

    await act(() => result.current.copy("hello", options));

    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.copied).toBe(false);
  });

  it("keeps copied = false on failure", async () => {
    mockCopyToClipboard.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useCopyToClipboard());

    const ok = await act(() => result.current.copy("hello", options));

    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
  });

  it("uses default resetMs of 2000", async () => {
    mockCopyToClipboard.mockResolvedValueOnce(true);
    const { result } = renderHook(() => useCopyToClipboard());

    await act(() => result.current.copy("hello", options));
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(1999));
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.copied).toBe(false);
  });
});
