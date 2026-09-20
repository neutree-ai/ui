import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useModelMappingRows } from "@/domains/external-endpoint/hooks/use-model-mapping-rows";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  INTERNAL_SHARED_MODEL_SOURCE,
  type ModelSourceMap,
  modelSourceTranslationKey,
} from "@/foundation/lib/model-source";
import { cn } from "@/foundation/lib/utils";

type ModelMappingEditorProps = {
  value?: Record<string, string>;
  onChange?: (v: Record<string, string>) => void;
  disabled?: boolean;
  /** Known upstream models from test connectivity, used to warn on mismatches */
  availableModels?: string[];
  /**
   * Model sources live on the endpoint spec, not on this upstream, because a
   * model can be routed across several upstreams. They are edited here anyway:
   * this is the row where the admin names the model, and a separate list keyed
   * by the same names would be two places to keep in step.
   */
  modelSources?: ModelSourceMap;
  onModelSourceChange?: (model: string, source: string) => void;
  modelSourceOptions?: { label: string; value: string }[];
  /**
   * This upstream points at an internal endpoint, so its models are internal by
   * construction and resolve without the admin choosing anything. Shown as the
   * placeholder rather than written in, so it stays a derivation: nothing is
   * stored unless the admin overrides it.
   */
  viaInternalEndpoint?: boolean;
};

export default function ModelMappingEditor({
  value,
  onChange,
  disabled,
  availableModels,
  modelSources,
  onModelSourceChange,
  modelSourceOptions,
  viaInternalEndpoint,
}: ModelMappingEditorProps) {
  const { t } = useTranslation();
  const { rows, duplicateIndices, updateRow, addRow, removeRow } =
    useModelMappingRows({ value, onChange });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-5 text-xs font-medium text-muted-foreground">
        <span>{t("external_endpoints.fields.upstreamModelName")}</span>
        <span>{t("external_endpoints.fields.exposedModelName")}</span>
        <span>{t("modelSource.label")}</span>
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
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-5">
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
              {/* Keyed by the exposed name, so the source follows the model
                  rather than this row's position. An unnamed row has nothing to
                  key on yet. */}
              <FormCombobox
                value={row.key ? (modelSources?.[row.key] ?? "") : ""}
                onChange={(next) =>
                  onModelSourceChange?.(row.key, String(next))
                }
                placeholder={
                  viaInternalEndpoint
                    ? t(
                        modelSourceTranslationKey(INTERNAL_SHARED_MODEL_SOURCE),
                        { defaultValue: INTERNAL_SHARED_MODEL_SOURCE },
                      )
                    : t("modelSource.placeholder")
                }
                options={modelSourceOptions ?? []}
                disabled={disabled || row.key === ""}
                allowCustomValue
                asField={false}
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
