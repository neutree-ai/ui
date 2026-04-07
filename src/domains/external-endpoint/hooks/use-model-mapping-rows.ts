import { useCallback, useEffect, useRef, useState } from "react";

type MappingRow = { key: string; value: string };

export function toRows(
  mapping: Record<string, string> | undefined,
): MappingRow[] {
  if (!mapping || Object.keys(mapping).length === 0) {
    return [{ key: "", value: "" }];
  }
  return Object.entries(mapping).map(([key, value]) => ({ key, value }));
}

export function toRecord(rows: MappingRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.key) {
      result[row.key] = row.value;
    }
  }
  return result;
}

/** Returns indices of rows whose key duplicates another row's key. */
export function findDuplicateKeyIndices(rows: MappingRow[]): Set<number> {
  const seen = new Map<string, number>();
  const duplicates = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    const k = rows[i].key;
    if (!k) continue;
    if (seen.has(k)) {
      duplicates.add(seen.get(k) as number);
      duplicates.add(i);
    } else {
      seen.set(k, i);
    }
  }
  return duplicates;
}

function buildCustomizedKeys(rows: MappingRow[]): Set<number> {
  const custom = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].key && rows[i].key !== rows[i].value) {
      custom.add(i);
    }
  }
  return custom;
}

/**
 * Hook that manages model mapping rows with auto-sync behavior:
 * - When upstream model name (value) is typed, if the exposed name (key) for
 *   that row has NOT been manually edited, it auto-syncs to the same value.
 * - Once the user manually edits an exposed name, that row stops auto-syncing.
 *
 * The data model: key = exposed name, value = upstream model name.
 */
export function useModelMappingRows(options: {
  value?: Record<string, string>;
  onChange?: (v: Record<string, string>) => void;
}) {
  const { value, onChange } = options;
  const [rows, setRows] = useState<MappingRow[]>(() => toRows(value));
  // Serialized version of the last value we emitted via onChange
  const lastEmitted = useRef<string>(JSON.stringify(value ?? {}));
  // Serialized version of the last incoming value prop we processed
  const lastIncoming = useRef<string>(JSON.stringify(value ?? {}));

  // Track which row indices have user-customized keys (exposed names).
  // Rows NOT in this set will auto-sync key = value.
  const customizedKeys = useRef<Set<number>>(
    buildCustomizedKeys(toRows(value)),
  );

  // Sync from external value when it genuinely changes
  useEffect(() => {
    const serialized = JSON.stringify(value ?? {});
    // Same incoming content as last render — skip (handles reference changes)
    if (serialized === lastIncoming.current) return;
    lastIncoming.current = serialized;
    // Matches what we last emitted — skip (preserves duplicate rows in local state)
    if (serialized === lastEmitted.current) return;
    // Genuine external change
    const newRows = toRows(value);
    setRows(newRows);
    lastEmitted.current = serialized;
    customizedKeys.current = buildCustomizedKeys(newRows);
  }, [value]);

  const emit = useCallback(
    (newRows: MappingRow[]) => {
      setRows(newRows);
      const record = toRecord(newRows);
      lastEmitted.current = JSON.stringify(record);
      onChange?.(record);
    },
    [onChange],
  );

  const updateRow = useCallback(
    (index: number, field: "key" | "value", val: string) => {
      setRows((prev) => {
        const updated = prev.map((row, i) => {
          if (i !== index) return row;

          if (field === "value") {
            // Upstream model name changed — auto-sync key if not customized
            if (!customizedKeys.current.has(index)) {
              return { key: val, value: val };
            }
            return { ...row, value: val };
          }

          // field === "key": user is editing exposed name
          customizedKeys.current.add(index);
          return { ...row, key: val };
        });

        const record = toRecord(updated);
        lastEmitted.current = JSON.stringify(record);
        onChange?.(record);
        return updated;
      });
    },
    [onChange],
  );

  const addRow = useCallback(() => {
    emit([...rows, { key: "", value: "" }]);
  }, [rows, emit]);

  const removeRow = useCallback(
    (index: number) => {
      if (rows.length <= 1) return;
      const newRows = rows.filter((_, i) => i !== index);
      // Rebuild customizedKeys with shifted indices
      const newCustomized = new Set<number>();
      for (const idx of customizedKeys.current) {
        if (idx < index) newCustomized.add(idx);
        else if (idx > index) newCustomized.add(idx - 1);
        // idx === index: removed, skip
      }
      customizedKeys.current = newCustomized;
      emit(newRows);
    },
    [rows, emit],
  );

  const duplicateIndices = findDuplicateKeyIndices(rows);

  return {
    rows,
    duplicateIndices,
    updateRow,
    addRow,
    removeRow,
  };
}
