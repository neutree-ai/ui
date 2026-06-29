import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type Schema, useVariablesInput } from "./use-variables-input";

const fillEditingRow = (
  result: { current: ReturnType<typeof useVariablesInput> },
  rowId: string,
  key: string,
  value: string,
) => {
  act(() => {
    result.current.handleEditingKeyChange(rowId, key);
  });
  act(() => {
    result.current.handleEditingValueChange(rowId, value);
  });
};

describe("useVariablesInput", () => {
  it("should initialize with one empty editing row", () => {
    const { result } = renderHook(() => useVariablesInput({}));

    expect(result.current.editingRows).toHaveLength(1);
    expect(result.current.editingRows[0]).toMatchObject({
      key: "",
      value: "",
    });
  });

  it("should add a new editing row", () => {
    const { result } = renderHook(() => useVariablesInput({}));

    act(() => {
      result.current.handleAddNewRow();
    });

    expect(result.current.editingRows).toHaveLength(2);
  });

  it("should update editing row key", () => {
    const { result } = renderHook(() => useVariablesInput({}));
    const rowId = result.current.editingRows[0].id;

    act(() => {
      result.current.handleEditingKeyChange(rowId, "testKey");
    });

    expect(result.current.editingRows[0].key).toBe("testKey");
  });

  it("should update editing row value", () => {
    const { result } = renderHook(() => useVariablesInput({}));
    const rowId = result.current.editingRows[0].id;

    act(() => {
      result.current.handleEditingValueChange(rowId, "testValue");
    });

    expect(result.current.editingRows[0].value).toBe("testValue");
  });

  it("should save editing row and call onChange", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useVariablesInput({ onChange }));
    const rowId = result.current.editingRows[0].id;

    fillEditingRow(result, rowId, "myKey", "myValue");
    act(() => {
      result.current.saveEditingRow(rowId);
    });

    expect(onChange).toHaveBeenCalledWith({ myKey: "myValue" });
    // Should add a new empty row after saving
    expect(result.current.editingRows).toHaveLength(1);
    expect(result.current.editingRows[0]).toMatchObject({
      key: "",
      value: "",
    });
  });

  it("should not save editing row if key is empty", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useVariablesInput({ onChange }));
    const rowId = result.current.editingRows[0].id;

    act(() => {
      result.current.handleEditingValueChange(rowId, "myValue");
    });

    act(() => {
      result.current.saveEditingRow(rowId);
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.editingRows).toHaveLength(1);
  });

  it("should not save editing row if key already exists", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useVariablesInput({
        value: { existingKey: "existingValue" },
        onChange,
      }),
    );
    const rowId = result.current.editingRows[0].id;

    fillEditingRow(result, rowId, "existingKey", "newValue");

    act(() => {
      result.current.saveEditingRow(rowId);
    });

    // onChange should not be called because key already exists
    expect(onChange).not.toHaveBeenCalled();
  });

  it("should not save editing row when an existing key has a falsy value", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useVariablesInput({
        value: { disabledFlag: false, zeroCount: 0 },
        onChange,
      }),
    );
    const rowId = result.current.editingRows[0].id;

    fillEditingRow(result, rowId, "disabledFlag", "true");

    act(() => {
      result.current.saveEditingRow(rowId);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should remove editing row and keep at least one empty row", () => {
    const { result } = renderHook(() => useVariablesInput({}));
    const rowId = result.current.editingRows[0].id;

    act(() => {
      result.current.handleRemoveEditingRow(rowId);
    });

    // Should still have one editing row
    expect(result.current.editingRows).toHaveLength(1);
    expect(result.current.editingRows[0]).toMatchObject({
      key: "",
      value: "",
    });
  });

  it("should remove editing row when multiple rows exist", () => {
    const { result } = renderHook(() => useVariablesInput({}));

    act(() => {
      result.current.handleAddNewRow();
    });

    expect(result.current.editingRows).toHaveLength(2);

    const firstRowId = result.current.editingRows[0].id;

    act(() => {
      result.current.handleRemoveEditingRow(firstRowId);
    });

    expect(result.current.editingRows).toHaveLength(1);
  });

  it("should remove variable and call onChange", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useVariablesInput({
        value: { key1: "value1", key2: "value2" },
        onChange,
      }),
    );

    act(() => {
      result.current.handleRemoveVariable("key1");
    });

    expect(onChange).toHaveBeenCalledWith({ key2: "value2" });
  });

  it("should update variable value and call onChange", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useVariablesInput({
        value: { key1: "value1" },
        onChange,
      }),
    );

    act(() => {
      result.current.handleUpdateValue("key1", "newValue");
    });

    expect(onChange).toHaveBeenCalledWith({ key1: "newValue" });
  });

  describe("value type processing", () => {
    it("should process number type correctly", () => {
      const onChange = vi.fn();
      const schema: Schema = {
        numKey: { type: "number" },
      };
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(result, rowId, "numKey", "42.5");
      act(() => {
        result.current.saveEditingRow(rowId);
      });

      expect(onChange).toHaveBeenCalledWith({ numKey: 42.5 });
    });

    it("should process integer type correctly", () => {
      const onChange = vi.fn();
      const schema: Schema = {
        intKey: { type: "integer" },
      };
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(result, rowId, "intKey", "42");
      act(() => {
        result.current.saveEditingRow(rowId);
      });

      expect(onChange).toHaveBeenCalledWith({ intKey: 42 });
    });

    it("should process boolean type correctly", () => {
      const onChange = vi.fn();
      const schema: Schema = {
        boolKey: { type: "boolean" },
      };
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(result, rowId, "boolKey", "true");
      act(() => {
        result.current.saveEditingRow(rowId);
      });

      expect(onChange).toHaveBeenCalledWith({ boolKey: true });
    });

    it("should process string type correctly", () => {
      const onChange = vi.fn();
      const schema: Schema = {
        strKey: { type: "string" },
      };
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(result, rowId, "strKey", "hello");
      act(() => {
        result.current.saveEditingRow(rowId);
      });

      expect(onChange).toHaveBeenCalledWith({ strKey: "hello" });
    });

    it("should not save editing row with empty value", () => {
      const onChange = vi.fn();
      const schema: Schema = {
        numKey: { type: "number" },
      };
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(result, rowId, "numKey", "");
      act(() => {
        result.current.saveEditingRow(rowId);
      });

      // Should not save when value is empty
      expect(onChange).not.toHaveBeenCalled();
    });

    it("should default object and array schema values to JSON containers", () => {
      const schema = {
        config: { type: "object" },
        stops: { type: "array" },
      } as unknown as Schema;
      const { result } = renderHook(() => useVariablesInput({ schema }));

      act(() => {
        result.current.handleEditingKeyChange(
          result.current.editingRows[0].id,
          "config",
        );
      });
      expect(result.current.editingRows[0].value).toBe("{}");

      act(() => {
        result.current.handleEditingKeyChange(
          result.current.editingRows[0].id,
          "stops",
        );
      });
      expect(result.current.editingRows[0].value).toBe("[]");
    });

    it("should parse object schema values before saving", () => {
      const onChange = vi.fn();
      const schema = {
        speculative_config: { type: "object" },
      } as unknown as Schema;
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(
        result,
        rowId,
        "speculative_config",
        '{"method":"mtp","nested":{"enabled":true}}',
      );
      act(() => {
        result.current.saveEditingRow(rowId);
      });

      expect(onChange).toHaveBeenCalledWith({
        speculative_config: {
          method: "mtp",
          nested: { enabled: true },
        },
      });
    });

    it("should parse array schema values before saving", () => {
      const onChange = vi.fn();
      const schema = {
        stop: { type: "array" },
      } as unknown as Schema;
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(result, rowId, "stop", '["</s>","<|end|>"]');
      act(() => {
        result.current.saveEditingRow(rowId);
      });

      expect(onChange).toHaveBeenCalledWith({
        stop: ["</s>", "<|end|>"],
      });
    });

    it("should keep invalid object JSON in the editing row and expose an error", () => {
      const onChange = vi.fn();
      const schema = {
        speculative_config: { type: "object" },
      } as unknown as Schema;
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(result, rowId, "speculative_config", '{"method":');
      act(() => {
        result.current.saveEditingRow(rowId);
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(result.current.editingRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: rowId, key: "speculative_config" }),
        ]),
      );
      expect(
        (
          result.current as unknown as {
            editingRowErrors: Record<string, string>;
          }
        ).editingRowErrors[rowId],
      ).toBe("components.variablesInput.invalidJsonValue");
    });

    it("should clear stale JSON errors when editing row key changes", () => {
      const onChange = vi.fn();
      const schema = {
        speculative_config: { type: "object" },
        enable_prefix_cache: { type: "boolean" },
      } as unknown as Schema;
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(result, rowId, "speculative_config", '{"method":');
      act(() => {
        result.current.saveEditingRow(rowId);
      });
      expect(result.current.editingRowErrors[rowId]).toBe(
        "components.variablesInput.invalidJsonValue",
      );

      act(() => {
        result.current.handleEditingKeyChange(rowId, "enable_prefix_cache");
      });

      expect(result.current.editingRowErrors[rowId]).toBeUndefined();
      expect(result.current.editingRows[0]).toMatchObject({
        key: "enable_prefix_cache",
        value: "false",
      });
    });

    it("should save multiple editing rows against the same base value", () => {
      const onChange = vi.fn();
      const schema = {
        speculative_config: { type: "object" },
        enable_prefix_cache: { type: "boolean" },
      } as unknown as Schema;
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );
      const firstRowId = result.current.editingRows[0].id;

      act(() => {
        result.current.handleEditingKeyChange(firstRowId, "speculative_config");
      });
      act(() => {
        result.current.handleAddNewRow();
      });
      const secondRowId = result.current.editingRows[1].id;
      act(() => {
        result.current.handleEditingKeyChange(
          secondRowId,
          "enable_prefix_cache",
        );
      });

      act(() => {
        result.current.saveEditingRows([firstRowId, secondRowId]);
      });

      expect(onChange).toHaveBeenCalledWith({
        speculative_config: {},
        enable_prefix_cache: false,
      });
    });
  });

  describe("schema key options", () => {
    it("should provide available schema keys excluding used ones", () => {
      const schema: Schema = {
        key1: { type: "string" },
        key2: { type: "number" },
        key3: { type: "boolean" },
      };
      const { result } = renderHook(() =>
        useVariablesInput({
          value: { key1: "value1" },
          schema,
        }),
      );

      expect(result.current.availableSchemaKeys).toEqual(["key2", "key3"]);
    });

    it("should provide schema key options with labels", () => {
      const schema: Schema = {
        key1: { type: "string", title: "Key 1 Title" },
        key2: { type: "number" },
      };
      const { result } = renderHook(() =>
        useVariablesInput({
          value: {},
          schema,
        }),
      );

      expect(result.current.schemaKeyOptions).toEqual([
        { label: "Key 1 Title", value: "key1" },
        { label: "key2", value: "key2" },
      ]);
    });
  });

  describe("keyboard interaction", () => {
    it("should save editing row on blur", () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      const { result } = renderHook(() => useVariablesInput({ onChange }));
      const rowId = result.current.editingRows[0].id;

      fillEditingRow(result, rowId, "myKey", "myValue");
      act(() => {
        result.current.handleEditingRowBlur(rowId);
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(onChange).toHaveBeenCalledWith({ myKey: "myValue" });
      vi.useRealTimers();
    });

    it("should not save editing row with empty key on blur", () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      const { result } = renderHook(() => useVariablesInput({ onChange }));

      act(() => {
        const rowId = result.current.editingRows[0].id;
        result.current.handleEditingValueChange(rowId, "myValue");
        result.current.handleEditingRowBlur(rowId);
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(onChange).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
