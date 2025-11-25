import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type Schema, useVariablesInput } from "./use-variables-input";

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

    act(() => {
      const rowId = result.current.editingRows[0].id;
      result.current.handleEditingKeyChange(rowId, "myKey");
      result.current.handleEditingValueChange(rowId, "myValue");
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

    act(() => {
      result.current.handleEditingKeyChange(rowId, "existingKey");
      result.current.handleEditingValueChange(rowId, "newValue");
    });

    act(() => {
      result.current.saveEditingRow(rowId);
    });

    // onChange should not be called because key already exists
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

      act(() => {
        const rowId = result.current.editingRows[0].id;
        result.current.handleEditingKeyChange(rowId, "numKey");
        result.current.handleEditingValueChange(rowId, "42.5");
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

      act(() => {
        const rowId = result.current.editingRows[0].id;
        result.current.handleEditingKeyChange(rowId, "intKey");
        result.current.handleEditingValueChange(rowId, "42");
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

      act(() => {
        const rowId = result.current.editingRows[0].id;
        result.current.handleEditingKeyChange(rowId, "boolKey");
        result.current.handleEditingValueChange(rowId, "true");
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

      act(() => {
        const rowId = result.current.editingRows[0].id;
        result.current.handleEditingKeyChange(rowId, "strKey");
        result.current.handleEditingValueChange(rowId, "hello");
        result.current.saveEditingRow(rowId);
      });

      expect(onChange).toHaveBeenCalledWith({ strKey: "hello" });
    });

    it("should handle empty number value correctly", () => {
      const onChange = vi.fn();
      const schema: Schema = {
        numKey: { type: "number" },
      };
      const { result } = renderHook(() =>
        useVariablesInput({ onChange, schema }),
      );

      act(() => {
        const rowId = result.current.editingRows[0].id;
        result.current.handleEditingKeyChange(rowId, "numKey");
        result.current.handleEditingValueChange(rowId, "");
        result.current.saveEditingRow(rowId);
      });

      expect(onChange).toHaveBeenCalledWith({ numKey: "" });
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
    it("should save editing row on Enter key press", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useVariablesInput({ onChange }));

      const mockEvent = {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      act(() => {
        const rowId = result.current.editingRows[0].id;
        result.current.handleEditingKeyChange(rowId, "myKey");
        result.current.handleEditingValueChange(rowId, "myValue");
        result.current.handleEditingRowKeyDown(rowId, mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith({ myKey: "myValue" });
    });

    it("should not save on other key press", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useVariablesInput({ onChange }));
      const rowId = result.current.editingRows[0].id;

      act(() => {
        result.current.handleEditingKeyChange(rowId, "myKey");
        result.current.handleEditingValueChange(rowId, "myValue");
      });

      const mockEvent = {
        key: "Tab",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      act(() => {
        result.current.handleEditingRowKeyDown(rowId, mockEvent);
      });

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
