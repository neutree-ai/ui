import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import type { Control, FieldValues } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox as AsyncCombobox } from "@/components/ui/combobox";
import type { ModelSpec } from "@/domains/endpoint/types";
import { FORM_GRID_GAP_CLASS } from "@/foundation/components/FormCardGrid";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { ModelOptionalFields } from "./ModelOptionalFields";

type ModelValue = Pick<ModelSpec, "registry" | "name" | "version" | "file">;

type ComboboxOption = {
  label: string;
  value: string;
  disabled?: boolean;
  description?: string;
};

export type VariantResetNotice = {
  variant: string;
  resetCount: number;
};

type Props = {
  direct: boolean;
  title: string;
  control: Control<FieldValues>;
  values: ModelValue;
  sourceLabel: string;
  editing: boolean;
  customized: boolean;
  registryOptions: ComboboxOption[];
  registryLoading: boolean;
  modelOptions: { label: string; value: string }[];
  modelLoading?: ReactNode;
  modelDisabled: boolean;
  allowReset: boolean;
  resetNotice: VariantResetNotice | null;
  onToggleEditing: () => void;
  onReset: () => void;
  onUndo: () => void;
  onRegistryChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onModelSearchChange: (value: string) => void;
  onVersionInput: () => void;
  onFileInput: () => void;
};

function StaticValue({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 break-all font-mono text-xs font-medium text-[var(--nt-text-neutral-super)]">
      {children || "—"}
    </div>
  );
}

export function EndpointResolvedModelEditor({
  direct,
  title,
  control,
  values,
  sourceLabel,
  editing,
  customized,
  registryOptions,
  registryLoading,
  modelOptions,
  modelLoading,
  modelDisabled,
  allowReset,
  resetNotice,
  onToggleEditing,
  onReset,
  onUndo,
  onRegistryChange,
  onModelChange,
  onModelSearchChange,
  onVersionInput,
  onFileInput,
}: Props) {
  const { t } = useTranslation();
  const versionFile = [
    values.version || t("endpoints.resolvedModel.auto"),
    values.file,
  ]
    .filter(Boolean)
    .join(" · ");
  const editableFields = (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2", FORM_GRID_GAP_CLASS)}>
      <FormFieldGroup
        control={control}
        name="spec.model.registry"
        label={t("endpoints.fields.modelRegistry")}
        required
      >
        <FormCombobox
          asField={false}
          placeholder={t("endpoints.placeholders.selectModelRegistry")}
          disabled={registryLoading}
          options={registryOptions}
          onChange={(value) => onRegistryChange(String(value))}
        />
      </FormFieldGroup>
      <FormFieldGroup
        control={control}
        name="spec.model.name"
        label={t("endpoints.fields.modelName")}
        required
      >
        <AsyncCombobox
          asField={false}
          placeholder={t("endpoints.placeholders.selectModel")}
          loading={modelLoading}
          options={modelOptions}
          shouldFilter={false}
          onSearchChange={onModelSearchChange}
          triggerClassName="w-full"
          disabled={modelDisabled}
          onChange={onModelChange}
        />
      </FormFieldGroup>
      <ModelOptionalFields
        control={control}
        values={values}
        onVersionInput={onVersionInput}
        onFileInput={onFileInput}
        className="sm:col-span-2"
      />
    </div>
  );

  if (direct) {
    return <div data-testid="endpoint-selected-model">{editableFields}</div>;
  }

  return (
    <section
      className="overflow-hidden rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)]"
      data-testid="endpoint-resolved-model"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--nt-stroke-outstanding-light)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-[var(--nt-text-neutral-super)]">
            {title}
          </h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
              customized
                ? "bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]"
                : "bg-[var(--nt-fill-outstanding-light)] text-[var(--nt-text-colorful-outstanding)]",
            )}
          >
            {customized ? t("endpoints.resolvedModel.custom") : sourceLabel}
          </span>
        </div>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto shrink-0 px-0 text-xs"
          onClick={onToggleEditing}
        >
          <Pencil className="mr-1 size-3.5" />
          {editing
            ? t("endpoints.resolvedModel.doneEditing")
            : customized
              ? t("endpoints.resolvedModel.editModel")
              : t("endpoints.resolvedModel.customizeModel")}
        </Button>
      </div>

      {editing ? (
        <div className="bg-[var(--nt-fill-neutral-white)]/70 px-4 py-4">
          {editableFields}
        </div>
      ) : (
        <dl className="grid grid-cols-1 bg-[var(--nt-fill-neutral-white)]/55 sm:grid-cols-3">
          {[
            [t("endpoints.fields.modelRegistry"), values.registry],
            [t("endpoints.fields.modelName"), values.name],
            [t("endpoints.resolvedModel.versionFile"), versionFile],
          ].map(([label, value]) => (
            <div
              key={label}
              className={cn(
                "min-w-0 border-b border-[var(--nt-stroke-outstanding-light)] px-4 py-3 sm:border-b-0 sm:border-l sm:first:border-l-0",
              )}
            >
              <dt className="mb-1 text-[11px] text-[var(--nt-text-neutral-tertiary)]">
                {label}
              </dt>
              <dd>
                <StaticValue>{value}</StaticValue>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {allowReset && customized && (
        <div className="flex flex-col items-start gap-2 border-t border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-neutral-white)]/55 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="text-xs text-[var(--nt-text-neutral-tertiary)]">
            {t("endpoints.resolvedModel.overrideHint")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={onReset}
          >
            {t("endpoints.resolvedModel.reset")}
          </Button>
        </div>
      )}

      {resetNotice && (
        <Alert
          variant="warning"
          className="rounded-none border-x-0 border-b-0"
          data-testid="endpoint-variant-reset-notice"
        >
          <AlertDescription className="flex items-start justify-between gap-4">
            <span>
              <strong className="block font-medium">
                {t("endpoints.resolvedModel.switched", {
                  variant: resetNotice.variant,
                })}
              </strong>
              <span>
                {t("endpoints.resolvedModel.resetNotice", {
                  count: resetNotice.resetCount,
                })}
              </span>
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto shrink-0 px-0 text-xs text-[var(--nt-text-colorful-notice)]"
              onClick={onUndo}
            >
              {t("endpoints.resolvedModel.undo")}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
