import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatModelInfoNumber } from "@/domains/model-catalog/lib/model-info-display";
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
      value: formatModelInfoNumber(info.parameter_count),
    });
  if (info.quantization)
    items.push({
      label: t("model_catalogs.modelInfo.quantization", "Quantization"),
      value: info.quantization,
    });
  if (info.context_length)
    items.push({
      label: t("model_catalogs.modelInfo.contextLength", "Context"),
      value: formatModelInfoNumber(info.context_length),
    });
  const architecture = info.architecture;
  if (items.length === 0 && !architecture) return null;

  if (variant === "inline") {
    return (
      <div className={className}>
        {items.map((it) => (
          <span key={it.label} className="text-xs text-muted-foreground mr-3">
            {it.label}: <span className="text-foreground">{it.value}</span>
          </span>
        ))}
        {architecture ? (
          <span className="inline-flex max-w-full whitespace-nowrap text-xs text-muted-foreground mr-3">
            {t("model_catalogs.modelInfo.architecture", "Architecture")}:{" "}
            <span className="truncate font-mono text-foreground">
              {architecture}
            </span>
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <Badge key={it.label} variant="secondary" className="font-normal">
            <span className="text-muted-foreground mr-1">{it.label}</span>
            {it.value}
          </Badge>
        ))}
      </div>
      {architecture ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              tabIndex={0}
              className="flex w-fit max-w-full min-w-0 cursor-help font-normal"
            >
              <span className="mr-1 shrink-0 whitespace-nowrap text-muted-foreground">
                {t("model_catalogs.modelInfo.architecture", "Architecture")}
              </span>
              <span className="min-w-0 truncate whitespace-nowrap font-mono">
                {architecture}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-md break-all font-mono">
            {architecture}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
};
