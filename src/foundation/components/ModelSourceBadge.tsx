import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  type ModelSource,
  modelSourceTranslationKey,
} from "@/foundation/lib/model-source";
import { cn } from "@/foundation/lib/utils";

/**
 * A model's source label, rendered as a badge. Replaces the Internal/External
 * badge on the model list, the detail page and the model picker.
 *
 * An unlabelled external endpoint renders the "unspecified" badge rather than
 * nothing, so the row still carries a source and still groups apart from the
 * self-hosted ones. An unrecognised slug renders as itself — see
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
