import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelInfo } from "@/foundation/types/serving-types";

type Props = {
  info?: ModelInfo | null;
  /** "badges" (default) for cards, "inline" for dense table cells. */
  variant?: "badges" | "inline";
  className?: string;
};

// ModelInfoBadges renders the display-only model metadata (parameter count /
// quantization / context length / architecture) that belongs to the model
// itself. Used on the catalog card and the variant table so both surfaces stay
// consistent. Renders nothing when no fields are present.
export const ModelInfoBadges = ({
  info,
  variant = "badges",
  className,
}: Props) => {
  const { t } = useTranslation();
  if (!info) return null;

  const items: Array<{ label: string; value: string }> = [];
  if (info.parameter_count)
    items.push({
      label: t("model_catalogs.modelInfo.parameterCount", "Parameters"),
      value: info.parameter_count,
    });
  if (info.quantization)
    items.push({
      label: t("model_catalogs.modelInfo.quantization", "Quantization"),
      value: info.quantization,
    });
  if (info.context_length)
    items.push({
      label: t("model_catalogs.modelInfo.contextLength", "Context"),
      value: info.context_length,
    });
  if (info.architecture)
    items.push({
      label: t("model_catalogs.modelInfo.architecture", "Architecture"),
      value: info.architecture,
    });

  if (items.length === 0) return null;

  if (variant === "inline") {
    return (
      <div className={className}>
        {items.map((it) => (
          <span key={it.label} className="text-xs text-muted-foreground mr-3">
            {it.label}: <span className="text-foreground">{it.value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {items.map((it) => (
        <Badge key={it.label} variant="secondary" className="font-normal">
          <span className="text-muted-foreground mr-1">{it.label}</span>
          {it.value}
        </Badge>
      ))}
    </div>
  );
};
