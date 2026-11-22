import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as storage from "../lib/column-visibility-storage";
import { useColumnVisibility } from "./use-column-visibility";

vi.mock("../lib/column-visibility-storage");

describe("useColumnVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads saved visibility on mount", () => {
    vi.mocked(storage.getColumnVisibility).mockReturnValue({
      col1: true,
      col2: false,
    });

    const { result } = renderHook(() => useColumnVisibility("clusters"));

    expect(storage.getColumnVisibility).toHaveBeenCalledWith("clusters");
    expect(result.current.columnVisibility).toEqual({
      col1: true,
      col2: false,
    });
    expect(result.current.isLoaded).toBe(true);
  });

  it("defaults to empty object when no saved state", () => {
    vi.mocked(storage.getColumnVisibility).mockReturnValue(undefined);

    const { result } = renderHook(() => useColumnVisibility("clusters"));

    expect(result.current.columnVisibility).toEqual({});
    expect(result.current.isLoaded).toBe(true);
  });

  it("updates visibility with direct object", () => {
    vi.mocked(storage.getColumnVisibility).mockReturnValue(undefined);

    const { result } = renderHook(() => useColumnVisibility("clusters"));

    act(() => {
      result.current.setColumnVisibility({ col1: false });
    });

    expect(result.current.columnVisibility).toEqual({ col1: false });
    expect(storage.setColumnVisibility).toHaveBeenCalledWith(
      "clusters",
      { col1: false },
      undefined,
    );
  });

  it("updates visibility with updater function", () => {
    vi.mocked(storage.getColumnVisibility).mockReturnValue({ col1: true });

    const { result } = renderHook(() => useColumnVisibility("clusters"));

    act(() => {
      result.current.setColumnVisibility((prev) => ({
        ...prev,
        col2: false,
      }));
    });

    expect(result.current.columnVisibility).toEqual({
      col1: true,
      col2: false,
    });
  });

  it("passes validColumnIds to storage", () => {
    vi.mocked(storage.getColumnVisibility).mockReturnValue(undefined);

    const { result } = renderHook(() => useColumnVisibility("clusters"));

    act(() => {
      result.current.setColumnVisibility({ col1: true, extra: true }, ["col1"]);
    });

    expect(storage.setColumnVisibility).toHaveBeenCalledWith(
      "clusters",
      { col1: true, extra: true },
      ["col1"],
    );
  });

  it("reloads when resourceName changes", () => {
    vi.mocked(storage.getColumnVisibility)
      .mockReturnValueOnce({ a: true })
      .mockReturnValueOnce({ b: false });

    const { result, rerender } = renderHook(
      ({ name }) => useColumnVisibility(name),
      { initialProps: { name: "clusters" } },
    );

    expect(result.current.columnVisibility).toEqual({ a: true });

    rerender({ name: "endpoints" });

    expect(storage.getColumnVisibility).toHaveBeenCalledWith("endpoints");
    expect(result.current.columnVisibility).toEqual({ b: false });
  });
});
