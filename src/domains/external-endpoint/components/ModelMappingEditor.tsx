import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/foundation/lib/i18n";
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

export default function ModelMappingEditor({
  value,
  onChange,
  disabled,
}: ModelMappingEditorProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<MappingRow[]>(() => toRows(value));
  const internalChange = useRef(false);

  useEffect(() => {
    if (internalChange.current) {
      internalChange.current = false;
      return;
    }
    setRows(toRows(value));
  }, [value]);

  const handleChange = useCallback(
    (newRows: MappingRow[]) => {
      setRows(newRows);
      internalChange.current = true;
      onChange?.(toRecord(newRows));
    },
    [onChange],
  );

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
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            value={row.key}
            onChange={(e) => updateRow(index, "key", e.target.value)}
            placeholder={t("external_endpoints.placeholders.exposedModelName")}
            disabled={disabled}
          />
          <Input
            value={row.value}
            onChange={(e) => updateRow(index, "value", e.target.value)}
            placeholder={t("external_endpoints.placeholders.upstreamModelName")}
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
      ))}
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
