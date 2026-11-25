import { type ReactNode, useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type ApiKeyLabelParts,
  apiKeyLabelDetails,
  apiKeyLabelParts,
} from "@/domains/api-key/lib/api-key-label";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { EmptyValue } from "@/foundation/type/EmptyValue";

/**
 * Class names that keep an API key select to a stable width: the open list
 * stops growing at the cap, and each item may shrink so its label can clip.
 */
export const API_KEY_SELECT_CONTENT_CLASS = "max-w-[360px]";
export const API_KEY_SELECT_ITEM_CLASS = "[&>span:last-child]:min-w-0";

/**
 * One clipped line. Its tooltip carries the full text when the line is cut off,
 * or always when `alwaysTip` says the tooltip holds more than the line shows.
 */
function ClippedLine({
  tip,
  alwaysTip = false,
  className,
  children,
}: {
  tip: ReactNode;
  alwaysTip?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const truncated = useIsTruncated(ref);
  const line = (
    <div
      ref={ref}
      tabIndex={truncated || alwaysTip ? 0 : undefined}
      className={cn("truncate", className)}
    >
      {children}
    </div>
  );
  if (!truncated && !alwaysTip) return line;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{line}</TooltipTrigger>
        <TooltipContent className="max-w-md break-all">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * An API key's name, with its technical name and description.
 *
 * `stacked` is the name with the technical name and description under it, for a
 * list row or table cell. `inline` is the name alone on one line, for a control
 * one line tall (a select trigger); `line` adds the description to that line,
 * for a chart legend. The one-line variants keep the rest in the tooltip.
 */
export function ApiKeyLabel({
  name,
  displayName,
  description,
  parts,
  variant = "stacked",
  className,
}: {
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
  /** A label already resolved by `apiKeyLabelParts`, in place of the three above. */
  parts?: ApiKeyLabelParts;
  variant?: "stacked" | "inline" | "line";
  className?: string;
}) {
  const { t } = useTranslation();
  const label = parts ?? apiKeyLabelParts({ name, displayName, description });
  const { primary, technicalName } = label;
  const detail = label.description;
  const primaryText = primary || <EmptyValue />;

  if (variant !== "stacked") {
    const lines = apiKeyLabelDetails(label, t("api_keys.label.technicalName"));
    return (
      <ClippedLine
        alwaysTip={lines.length > 1}
        tip={lines.map((line) => <div key={line}>{line}</div>)}
        className={cn("min-w-0 text-sm", className)}
      >
        {primaryText}
        {variant === "line" && detail ? (
          <span className="ml-1 text-[10px] font-normal"> - {detail}</span>
        ) : null}
      </ClippedLine>
    );
  }

  return (
    <div className={cn("min-w-0 text-left", className)}>
      <ClippedLine tip={primary} className="text-sm">
        {primaryText}
      </ClippedLine>
      {technicalName ? (
        <ClippedLine
          tip={technicalName}
          className="font-mono text-[10px] font-normal leading-4 text-muted-foreground/70"
        >
          {technicalName}
        </ClippedLine>
      ) : null}
      {detail ? (
        // The leading is explicit: at 10px the line otherwise inherits the
        // name's 20px line box, which reads as a gap between the two lines and
        // pushes the block out of any control sized for one line.
        <ClippedLine
          tip={detail}
          className="text-[10px] font-normal leading-4 text-muted-foreground/70"
        >
          {detail}
        </ClippedLine>
      ) : null}
    </div>
  );
}
