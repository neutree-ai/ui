import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatModelInfoNumber } from "@/foundation/lib/model-info-display";
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
  const architectureRef = useRef<HTMLSpanElement>(null);
  const architectureTruncated = useIsTruncated(architectureRef);
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

  const architectureBadge = (
    <Badge
      variant="secondary"
      tabIndex={architectureTruncated ? 0 : undefined}
      className="flex w-fit max-w-full min-w-0 font-normal"
    >
      <span className="mr-1 shrink-0 whitespace-nowrap text-muted-foreground">
        {t("model_catalogs.modelInfo.architecture", "Architecture")}
      </span>
      <span
        ref={architectureRef}
        className="min-w-0 truncate whitespace-nowrap font-mono"
      >
        {architecture}
      </span>
    </Badge>
  );

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
            <span className="min-w-0 truncate font-mono text-foreground">
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
        // The tooltip is the way to the whole value when the badge clips it, and
        // it hangs on that state alone: an architecture short enough to fit has
        // nothing to reveal, so it neither opens a popup nor takes a tab stop.
        // The cursor stays a cursor either way — a question mark promises an
        // explanation, and this only repeats the value.
        <>
          {architectureTruncated ? (
            <Tooltip>
              <TooltipTrigger asChild>{architectureBadge}</TooltipTrigger>
              <TooltipContent className="max-w-md break-all font-mono">
                {architecture}
              </TooltipContent>
            </Tooltip>
          ) : (
            architectureBadge
          )}
        </>
      ) : null}
    </div>
  );
};
