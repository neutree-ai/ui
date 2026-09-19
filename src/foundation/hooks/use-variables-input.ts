import { useMemo, useRef, useState } from "react";

// Define schema types
type SchemaPropertyType =
  | "string"
  | "number"
  | "boolean"
  | "integer"
  | "float"
  | "object"
  | "array";

export interface SchemaProperty {
  type: SchemaPropertyType | SchemaPropertyType[];
  title?: string;
  description?: string;
  pattern?: string;
}

export interface Schema {
  [key: string]: SchemaProperty;
}

export interface EditingRow {
  id: string;
  key: string;
  value: string;
}

export const INVALID_JSON_ERROR = "components.variablesInput.invalidJsonValue";
const INVALID_PATTERN_ERROR = "components.variablesInput.invalidPatternValue";

let nextEditingRowId = 0;

const createEditingRow = (): EditingRow => ({
  id: `editing-row-${nextEditingRowId++}`,
  key: "",
  value: "",
});

const getDefaultValueForType = (
  type: SchemaPropertyType | SchemaPropertyType[],
): string => {
  if (Array.isArray(type)) return "";

  switch (type) {
    case "boolean":
      return "false";
    case "number":
    case "float":
    case "integer":
      return "0";
    case "object":
      return "{}";
    case "array":
      return "[]";
    default:
      return "";
  }
};

const parseJsonValue = (
  rawValue: string,
  type: "object" | "array",
): { ok: true; value: Record<string, unknown> | unknown[] } | { ok: false } => {
  try {
    const parsed = JSON.parse(rawValue);
    if (type === "array") {
      return Array.isArray(parsed)
        ? { ok: true, value: parsed }
        : { ok: false };
    }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return { ok: true, value: parsed as Record<string, unknown> };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
};

interface UseVariablesInputProps {
  value?: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
  schema?: Schema;
}

export function useVariablesInput({
  value = {},
  onChange = () => {},
  schema = {},
}: UseVariablesInputProps) {
  const [editingRows, setEditingRows] = useState<EditingRow[]>(() => [
    createEditingRow(),
  ]);
  const editingRowsRef = useRef(editingRows);
  const [editingRowErrors, setEditingRowErrors] = useState<
    Record<string, string>
  >({});

  const updateEditingRows = (
    updater: EditingRow[] | ((prev: EditingRow[]) => EditingRow[]),
  ) => {
    setEditingRows((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      editingRowsRef.current = next;
      return next;
    });
  };

  const availableSchemaKeys = useMemo(() => {
    const usedKeys = Object.keys(value);
    const schemaKeys = Object.keys(schema);
    return schemaKeys.filter((key) => !usedKeys.includes(key));
  }, [value, schema]);

  const schemaKeyOptions = useMemo(() => {
    return availableSchemaKeys.map((key) => ({
      label: schema[key]?.title || key,
      value: key,
    }));
  }, [availableSchemaKeys, schema]);

  const handleAddNewRow = () => {
    updateEditingRows((prev) => [...prev, createEditingRow()]);
  };

  const handleEditingKeyChange = (id: string, newKey: string) => {
    setEditingRowErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    updateEditingRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        // If the new key exists in schema, auto-fill default value based on type
        if (schema[newKey]) {
          const defaultValue = getDefaultValueForType(schema[newKey].type);

          return { ...row, key: newKey, value: defaultValue };
        }

        return { ...row, key: newKey };
      }),
    );
  };

  const handleEditingValueChange = (id: string, newValue: string) => {
    setEditingRowErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    updateEditingRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, value: newValue } : row)),
    );
  };

  const processValue = (key: string, rawValue: string) => {
    if (!schema[key]) return rawValue;

    const type = schema[key].type;
    if (Array.isArray(type)) return rawValue;

    if (type === "number" || type === "float") {
      return rawValue === "" ? "" : Number.parseFloat(rawValue);
    }
    if (type === "integer") {
      return rawValue === "" ? "" : Number.parseInt(rawValue, 10);
    }
    if (type === "boolean") {
      return rawValue === "true";
    }
    if (type === "object" || type === "array") {
      return parseJsonValue(rawValue, type);
    }
    return rawValue;
  };

  const saveEditingRows = (ids: string[]): boolean => {
    const rowsById = new Map(
      editingRowsRef.current.map((row) => [row.id, row]),
    );
    const nextValue = { ...value };
    const savedIds = new Set<string>();
    const nextErrors: Record<string, string> = {};
    let changed = false;

    for (const id of ids) {
      const row = rowsById.get(id);
      // Don't save if key or value is empty
      if (!row || !row.key.trim() || !row.value.trim()) continue;

      // Check if key already exists, including keys saved earlier in this batch.
      if (Object.hasOwn(nextValue, row.key)) continue;

      const pattern = schema[row.key]?.pattern;
      if (pattern && !new RegExp(pattern).test(row.value)) {
        nextErrors[id] = INVALID_PATTERN_ERROR;
        continue;
      }

      const processedValue = processValue(row.key, row.value);
      if (
        typeof processedValue === "object" &&
        processedValue !== null &&
        "ok" in processedValue
      ) {
        if (!processedValue.ok) {
          nextErrors[id] = INVALID_JSON_ERROR;
          continue;
        }
        nextValue[row.key] = processedValue.value;
      } else {
        nextValue[row.key] = processedValue;
      }
      savedIds.add(id);
      changed = true;
    }

    if (Object.keys(nextErrors).length > 0) {
      setEditingRowErrors((errors) => ({
        ...errors,
        ...nextErrors,
      }));
    }

    if (changed) {
      onChange(nextValue);
    }

    if (savedIds.size > 0) {
      updateEditingRows((prev) => {
        const remainingRows = prev.filter((row) => !savedIds.has(row.id));
        if (remainingRows.length === 0) {
          return [createEditingRow()];
        }
        return remainingRows;
      });
    }

    return Object.keys(nextErrors).length === 0;
  };

  const saveEditingRow = (id: string): boolean => {
    return saveEditingRows([id]);
  };

  const handleEditingRowBlur = (id: string) => {
    // Use setTimeout to allow dropdown clicks to complete first
    setTimeout(() => {
      saveEditingRow(id);
    }, 200);
  };

  const handleRemoveEditingRow = (id: string) => {
    updateEditingRows((prev) => {
      const remainingRows = prev.filter((r) => r.id !== id);
      setEditingRowErrors((errors) => {
        if (!errors[id]) return errors;
        const next = { ...errors };
        delete next[id];
        return next;
      });
      // Always keep at least one empty editing row
      if (remainingRows.length === 0) {
        return [createEditingRow()];
      }
      return remainingRows;
    });
  };

  const handleRemoveVariable = (key: string) => {
    const updatedVariables = { ...value };
    delete updatedVariables[key];
    onChange(updatedVariables);
  };

  const handleUpdateValue = (key: string, newVal: unknown) => {
    onChange({
      ...value,
      [key]: newVal,
    });
  };

  return {
    // State
    editingRows,
    editingRowErrors,
    availableSchemaKeys,
    schemaKeyOptions,

    // Methods
    handleAddNewRow,
    handleEditingKeyChange,
    handleEditingValueChange,
    handleEditingRowBlur,
    handleRemoveEditingRow,
    handleRemoveVariable,
    handleUpdateValue,
    saveEditingRow,
    saveEditingRows,
  };
}
