import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type MappingRow = { key: string; value: string };

type ModelMappingEditorProps = {
  value?: Record<string, string>;
  onChange?: (v: Record<string, string>) => void;
  disabled?: boolean;
};

function toRows(mapping: Record<string, string> | undefined): MappingRow[] {
  if (!mapping || Object.keys(mapping).length === 0) {
    return [{ key: "", value: "" }];
  }
  return Object.entries(mapping).map(([key, value]) => ({ key, value }));
}

function toRecord(rows: MappingRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.key) {
      result[row.key] = row.value;
    }
  }
  return result;
}

/** Returns indices of rows whose key duplicates another row's key. */
function findDuplicateKeyIndices(rows: MappingRow[]): Set<number> {
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

export default function ModelMappingEditor({
  value,
  onChange,
  disabled,
}: ModelMappingEditorProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<MappingRow[]>(() => toRows(value));
  const lastEmitted = useRef<Record<string, string>>(value ?? {});

  useEffect(() => {
    // Only sync from external value when it genuinely differs from what we
    // last emitted, so that duplicate rows are preserved during editing.
    if (JSON.stringify(lastEmitted.current) === JSON.stringify(value)) {
      return;
    }
    setRows(toRows(value));
    lastEmitted.current = value ?? {};
  }, [value]);

  const handleChange = useCallback(
    (newRows: MappingRow[]) => {
      setRows(newRows);
      const record = toRecord(newRows);
      lastEmitted.current = record;
      onChange?.(record);
    },
    [onChange],
  );

  const duplicateIndices = findDuplicateKeyIndices(rows);

  const updateRow = (index: number, field: "key" | "value", val: string) => {
    const updated = rows.map((row, i) =>
      i === index ? { ...row, [field]: val } : row,
    );
    handleChange(updated);
  };

  const addRow = () => {
    handleChange([...rows, { key: "", value: "" }]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    handleChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
        <span>{t("external_endpoints.fields.exposedModelName")}</span>
        <span>{t("external_endpoints.fields.upstreamModelName")}</span>
        <span className="w-8" />
      </div>
      {rows.map((row, index) => {
        const isDup = duplicateIndices.has(index);
        return (
          <div key={index} className="space-y-1">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                value={row.key}
                onChange={(e) => updateRow(index, "key", e.target.value)}
                placeholder={t(
                  "external_endpoints.placeholders.exposedModelName",
                )}
                disabled={disabled}
                className={cn(isDup && "border-destructive")}
              />
              <Input
                value={row.value}
                onChange={(e) => updateRow(index, "value", e.target.value)}
                placeholder={t(
                  "external_endpoints.placeholders.upstreamModelName",
                )}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(index)}
                disabled={disabled || rows.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {isDup && (
              <p className="text-[0.8rem] text-destructive">
                {t("external_endpoints.validation.duplicateModelKey")}
              </p>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        disabled={disabled}
      >
        <Plus className="mr-1 h-4 w-4" />
        {t("external_endpoints.actions.addModelMapping")}
      </Button>
    </div>
  );
}
