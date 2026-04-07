import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useModelMappingRows } from "@/domains/external-endpoint/hooks/use-model-mapping-rows";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

type ModelMappingEditorProps = {
  value?: Record<string, string>;
  onChange?: (v: Record<string, string>) => void;
  disabled?: boolean;
  /** Known upstream models from test connectivity, used to warn on mismatches */
  availableModels?: string[];
};

export default function ModelMappingEditor({
  value,
  onChange,
  disabled,
  availableModels,
}: ModelMappingEditorProps) {
  const { t } = useTranslation();
  const { rows, duplicateIndices, updateRow, addRow, removeRow } =
    useModelMappingRows({ value, onChange });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
        <span>{t("external_endpoints.fields.upstreamModelName")}</span>
        <span>{t("external_endpoints.fields.exposedModelName")}</span>
        <span className="w-8" />
      </div>
      {rows.map((row, index) => {
        const isDup = duplicateIndices.has(index);
        const isUnknownModel =
          availableModels &&
          availableModels.length > 0 &&
          row.value !== "" &&
          !availableModels.includes(row.value);
        return (
          <div key={index} className="space-y-1">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <div>
                <div className="relative">
                  <Input
                    value={row.value}
                    onChange={(e) => updateRow(index, "value", e.target.value)}
                    placeholder={t(
                      "external_endpoints.placeholders.upstreamModelName",
                    )}
                    disabled={disabled}
                    className={cn(isUnknownModel && "border-amber-500 pr-8")}
                  />
                  {isUnknownModel && (
                    <TriangleAlert className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                  )}
                </div>
                {isUnknownModel && !isDup && (
                  <p className="text-[0.8rem] text-amber-500">
                    {t("external_endpoints.validation.unknownUpstreamModel")}
                  </p>
                )}
              </div>
              <Input
                value={row.key}
                onChange={(e) => updateRow(index, "key", e.target.value)}
                placeholder={t(
                  "external_endpoints.placeholders.exposedModelName",
                )}
                disabled={disabled}
                className={cn(isDup && "border-destructive")}
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
