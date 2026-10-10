import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  type ModelSource,
  modelSourceTranslationKey,
} from "@/foundation/lib/model-source";
import { cn } from "@/foundation/lib/utils";

/**
 * A model's source, rendered as a badge.
 *
 * A model with no source renders the "unspecified" badge rather than nothing,
 * so the row still carries a source: in the API-key model picker the same model
 * name can appear once as self-hosted and once with no source, and an empty
 * slot there would read as "no source" instead of "source unknown". Pass
 * `hideUnspecified` where the badge is only decoration and an empty chip is
 * noise. A value outside the presets renders as itself — see
 * `modelSourceTranslationKey`.
 */
export function useModelSourceLabel() {
  const { t } = useTranslation();
  return (source: ModelSource | undefined) =>
    source
      ? t(modelSourceTranslationKey(source), { defaultValue: source })
      : t("modelSource.unspecified");
}

export function ModelSourceBadge({
  source,
  hideUnspecified = false,
  className,
}: {
  source: ModelSource | undefined;
  hideUnspecified?: boolean;
  className?: string;
}) {
  const label = useModelSourceLabel();
  if (hideUnspecified && !source) return null;
  return (
    <Badge variant="outline" className={cn("h-5 font-normal", className)}>
      {label(source)}
    </Badge>
  );
}
