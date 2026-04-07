import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  findDuplicateKeyIndices,
  toRecord,
  toRows,
  useModelMappingRows,
} from "./use-model-mapping-rows";

describe("toRows", () => {
  it("returns one empty row for undefined", () => {
    expect(toRows(undefined)).toEqual([{ key: "", value: "" }]);
  });

  it("returns one empty row for empty object", () => {
    expect(toRows({})).toEqual([{ key: "", value: "" }]);
  });

  it("converts record to rows", () => {
    expect(toRows({ "gpt-4o": "gpt-4o", claude: "claude-3" })).toEqual([
      { key: "gpt-4o", value: "gpt-4o" },
      { key: "claude", value: "claude-3" },
    ]);
  });
});

describe("toRecord", () => {
  it("converts rows to record, filtering empty keys", () => {
    expect(
      toRecord([
        { key: "a", value: "b" },
        { key: "", value: "ignored" },
        { key: "c", value: "d" },
      ]),
    ).toEqual({ a: "b", c: "d" });
  });

  it("returns empty object for all-empty keys", () => {
    expect(toRecord([{ key: "", value: "" }])).toEqual({});
  });
});

describe("findDuplicateKeyIndices", () => {
  it("returns empty set when no duplicates", () => {
    expect(
      findDuplicateKeyIndices([
        { key: "a", value: "1" },
        { key: "b", value: "2" },
      ]),
    ).toEqual(new Set());
  });

  it("marks both original and duplicate indices", () => {
    expect(
      findDuplicateKeyIndices([
        { key: "a", value: "1" },
        { key: "b", value: "2" },
        { key: "a", value: "3" },
      ]),
    ).toEqual(new Set([0, 2]));
  });

  it("ignores empty keys", () => {
    expect(
      findDuplicateKeyIndices([
        { key: "", value: "1" },
        { key: "", value: "2" },
      ]),
    ).toEqual(new Set());
  });
});

describe("useModelMappingRows", () => {
  it("initializes with one empty row when no value", () => {
    const { result } = renderHook(() => useModelMappingRows({}));
    expect(result.current.rows).toEqual([{ key: "", value: "" }]);
  });

  it("initializes from value prop", () => {
    const { result } = renderHook(() =>
      useModelMappingRows({ value: { "gpt-4o": "gpt-4o" } }),
    );
    expect(result.current.rows).toEqual([{ key: "gpt-4o", value: "gpt-4o" }]);
  });

  describe("auto-sync: upstream → exposed", () => {
    it("auto-syncs key when value is typed on a fresh row", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useModelMappingRows({ onChange }));

      act(() => {
        result.current.updateRow(0, "value", "gpt-4o");
      });

      expect(result.current.rows[0]).toEqual({
        key: "gpt-4o",
        value: "gpt-4o",
      });
      expect(onChange).toHaveBeenLastCalledWith({ "gpt-4o": "gpt-4o" });
    });

    it("continues syncing key as value changes", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useModelMappingRows({ onChange }));

      act(() => {
        result.current.updateRow(0, "value", "gpt");
      });
      expect(result.current.rows[0].key).toBe("gpt");

      act(() => {
        result.current.updateRow(0, "value", "gpt-4o");
      });
      expect(result.current.rows[0].key).toBe("gpt-4o");
    });

    it("stops syncing after user manually edits the key", () => {
      const { result } = renderHook(() => useModelMappingRows({}));

      // Type upstream name — key auto-syncs
      act(() => {
        result.current.updateRow(0, "value", "gpt-4o");
      });
      expect(result.current.rows[0].key).toBe("gpt-4o");

      // User edits exposed name
      act(() => {
        result.current.updateRow(0, "key", "my-model");
      });
      expect(result.current.rows[0]).toEqual({
        key: "my-model",
        value: "gpt-4o",
      });

      // Change upstream again — key should NOT change
      act(() => {
        result.current.updateRow(0, "value", "gpt-4o-mini");
      });
      expect(result.current.rows[0]).toEqual({
        key: "my-model",
        value: "gpt-4o-mini",
      });
    });

    it("marks existing rows with differing key/value as customized on init", () => {
      const { result } = renderHook(() =>
        useModelMappingRows({ value: { "custom-name": "gpt-4o" } }),
      );

      // Change upstream — key should NOT sync because it was already customized
      act(() => {
        result.current.updateRow(0, "value", "gpt-4o-mini");
      });
      expect(result.current.rows[0]).toEqual({
        key: "custom-name",
        value: "gpt-4o-mini",
      });
    });

    it("treats existing rows with matching key/value as auto-syncable", () => {
      const { result } = renderHook(() =>
        useModelMappingRows({ value: { "gpt-4o": "gpt-4o" } }),
      );

      // Change upstream — key should sync because key === value on init
      act(() => {
        result.current.updateRow(0, "value", "gpt-4o-mini");
      });
      expect(result.current.rows[0]).toEqual({
        key: "gpt-4o-mini",
        value: "gpt-4o-mini",
      });
    });
  });

  describe("addRow", () => {
    it("appends an empty row", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useModelMappingRows({ value: { a: "b" }, onChange }),
      );

      act(() => {
        result.current.addRow();
      });

      expect(result.current.rows).toHaveLength(2);
      expect(result.current.rows[1]).toEqual({ key: "", value: "" });
    });
  });

  describe("removeRow", () => {
    it("removes a row by index", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useModelMappingRows({
          value: { "model-a": "a", "model-b": "b" },
          onChange,
        }),
      );

      act(() => {
        result.current.removeRow(0);
      });

      expect(result.current.rows).toEqual([{ key: "model-b", value: "b" }]);
      expect(onChange).toHaveBeenLastCalledWith({ "model-b": "b" });
    });

    it("prevents removing the last row", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useModelMappingRows({ onChange }));

      act(() => {
        result.current.removeRow(0);
      });

      expect(result.current.rows).toHaveLength(1);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("preserves customization state with shifted indices after removal", () => {
      const { result } = renderHook(() =>
        useModelMappingRows({
          value: { a: "x", "custom-name": "y", c: "z" },
        }),
      );

      // Row 1 has differing key/value → customized
      // Remove row 0 → row 1 becomes row 0
      act(() => {
        result.current.removeRow(0);
      });

      // Now row 0 is the customized one — changing value should NOT sync key
      act(() => {
        result.current.updateRow(0, "value", "new-val");
      });
      expect(result.current.rows[0].key).toBe("custom-name");
    });
  });

  describe("duplicateIndices", () => {
    it("detects duplicates in current rows", () => {
      const { result } = renderHook(() =>
        useModelMappingRows({ value: { a: "1" } }),
      );

      act(() => {
        result.current.addRow();
      });
      act(() => {
        result.current.updateRow(1, "value", "a");
      });

      // Both rows have key "a" (row 1 auto-synced)
      expect(result.current.duplicateIndices).toEqual(new Set([0, 1]));
    });
  });

  describe("external value sync", () => {
    it("syncs rows when external value changes", () => {
      const { result, rerender } = renderHook(
        ({ value }: { value: Record<string, string> }) =>
          useModelMappingRows({ value }),
        { initialProps: { value: { a: "1" } } },
      );

      rerender({ value: { b: "2", c: "3" } });

      expect(result.current.rows).toEqual([
        { key: "b", value: "2" },
        { key: "c", value: "3" },
      ]);
    });

    it("does not re-sync when value matches last emitted", () => {
      const onChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ value }: { value: Record<string, string> }) =>
          useModelMappingRows({ value, onChange }),
        { initialProps: { value: { a: "1" } } },
      );

      // User types — emits { a: "1", "gpt-4o": "gpt-4o" } via addRow+updateRow
      act(() => {
        result.current.addRow();
      });
      act(() => {
        result.current.updateRow(1, "value", "gpt-4o");
      });

      const emitted = onChange.mock.calls.at(-1)![0];
      // Re-render with same value as emitted — should NOT reset rows
      rerender({ value: emitted });

      expect(result.current.rows).toHaveLength(2);
    });
  });
});
