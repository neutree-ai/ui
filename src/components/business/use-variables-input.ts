import { useMemo, useState } from "react";

// Define schema types
export type SchemaPropertyType =
  | "string"
  | "number"
  | "boolean"
  | "integer"
  | "float";

export interface SchemaProperty {
  type: SchemaPropertyType;
  title?: string;
  description?: string;
}

export interface Schema {
  [key: string]: SchemaProperty;
}

export interface EditingRow {
  id: string;
  key: string;
  value: string;
}

export interface UseVariablesInputProps {
  value?: Record<string, any>;
  onChange?: (value: Record<string, any>) => void;
  schema?: Schema;
}

export function useVariablesInput({
  value = {},
  onChange = () => {},
  schema = {},
}: UseVariablesInputProps) {
  const [editingRows, setEditingRows] = useState<EditingRow[]>([
    { id: Date.now().toString(), key: "", value: "" },
  ]);

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
    setEditingRows([
      ...editingRows,
      { id: Date.now().toString(), key: "", value: "" },
    ]);
  };

  const handleEditingKeyChange = (id: string, newKey: string) => {
    setEditingRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, key: newKey } : row)),
    );
  };

  const handleEditingValueChange = (id: string, newValue: string) => {
    setEditingRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, value: newValue } : row)),
    );
  };

  const processValue = (key: string, rawValue: string) => {
    if (!schema[key]) return rawValue;

    const type = schema[key].type;
    if (type === "number" || type === "float") {
      return rawValue === "" ? "" : Number.parseFloat(rawValue);
    }
    if (type === "integer") {
      return rawValue === "" ? "" : Number.parseInt(rawValue, 10);
    }
    if (type === "boolean") {
      return rawValue === "true";
    }
    return rawValue;
  };

  const saveEditingRow = (id: string) => {
    setEditingRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (!row || !row.key.trim()) return prev;

      // Check if key already exists
      if (value[row.key]) return prev;

      const processedValue = processValue(row.key, row.value);

      const updatedVariables = {
        ...value,
        [row.key]: processedValue,
      };

      onChange(updatedVariables);

      // Remove editing row and add a new empty one if this was the last row
      const remainingRows = prev.filter((r) => r.id !== id);
      if (remainingRows.length === 0) {
        return [{ id: Date.now().toString(), key: "", value: "" }];
      }
      return remainingRows;
    });
  };

  const handleEditingRowKeyDown = (
    id: string,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditingRow(id);
    }
  };

  const handleRemoveEditingRow = (id: string) => {
    setEditingRows((prev) => {
      const remainingRows = prev.filter((r) => r.id !== id);
      // Always keep at least one empty editing row
      if (remainingRows.length === 0) {
        return [{ id: Date.now().toString(), key: "", value: "" }];
      }
      return remainingRows;
    });
  };

  const handleRemoveVariable = (key: string) => {
    const updatedVariables = { ...value };
    delete updatedVariables[key];
    onChange(updatedVariables);
  };

  const handleUpdateValue = (key: string, newVal: any) => {
    onChange({
      ...value,
      [key]: newVal,
    });
  };

  return {
    // State
    editingRows,
    availableSchemaKeys,
    schemaKeyOptions,

    // Methods
    handleAddNewRow,
    handleEditingKeyChange,
    handleEditingValueChange,
    handleEditingRowKeyDown,
    handleRemoveEditingRow,
    handleRemoveVariable,
    handleUpdateValue,
    saveEditingRow,
  };
}
