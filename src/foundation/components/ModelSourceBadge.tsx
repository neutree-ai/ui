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
 * so the row still carries a source. A value outside the presets renders as
 * itself — see `modelSourceTranslationKey`.
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
  className,
}: {
  source: ModelSource | undefined;
  className?: string;
}) {
  const label = useModelSourceLabel();
  return (
    <Badge variant="outline" className={cn("h-5 font-normal", className)}>
      {label(source)}
    </Badge>
  );
}
