import { ChevronDown } from "lucide-react";
import { useId, useLayoutEffect, useState } from "react";
import {
  type Control,
  type FieldValues,
  get,
  useFormState,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ModelSpec } from "@/domains/endpoint/types";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { FORM_GRID_GAP_CLASS } from "@/foundation/scene/FormCardGrid";
import { FormFieldGroup } from "@/foundation/scene/FormFieldGroup";

type Props = {
  control: Control<FieldValues>;
  values: Pick<ModelSpec, "version" | "file">;
  onVersionInput?: () => void;
  onFileInput?: () => void;
  className?: string;
};

const OPTIONAL_MODEL_ERROR_PATHS = [
  "spec.model.version",
  "spec.model.file",
] as const;

/**
 * Version and file are optional refinements of a registry model. Keep them out
 * of the default form scan, while expanding automatically when an existing
 * endpoint already carries either value.
 */
export function ModelOptionalFields({
  control,
  values,
  onVersionInput,
  onFileInput,
  className,
}: Props) {
  const { t } = useTranslation();
  const contentId = useId();
  const { errors } = useFormState({
    control,
    name: [...OPTIONAL_MODEL_ERROR_PATHS],
  });
  const hasError = OPTIONAL_MODEL_ERROR_PATHS.some((path) =>
    Boolean(get(errors, path)),
  );
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(
    null,
  );
  const expanded = expandedOverride ?? Boolean(values.version || values.file);

  useLayoutEffect(() => {
    if (hasError) setExpandedOverride(true);
  }, [hasError]);

  return (
    <div
      className={cn("space-y-2", className)}
      data-testid="model-optional-fields"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto px-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
        aria-expanded={expanded}
        aria-controls={contentId}
        data-testid="model-optional-fields-toggle"
        onClick={() => setExpandedOverride(!expanded)}
      >
        {expanded
          ? t("endpoints.wizard.model.hideOptionalFields")
          : t("endpoints.wizard.model.showOptionalFields")}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "ml-1 size-3.5 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </Button>

      <div
        id={contentId}
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2",
          FORM_GRID_GAP_CLASS,
          !expanded && "hidden",
        )}
      >
        <FormFieldGroup
          control={control}
          name="spec.model.version"
          label={t("endpoints.fields.modelVersion")}
          description={t("endpoints.wizard.model.versionHint")}
        >
          <Input onInput={onVersionInput} />
        </FormFieldGroup>
        <FormFieldGroup
          control={control}
          name="spec.model.file"
          label={t("endpoints.fields.modelFile")}
          description={t("endpoints.wizard.model.fileHint")}
        >
          <Input onInput={onFileInput} />
        </FormFieldGroup>
      </div>
    </div>
  );
}
