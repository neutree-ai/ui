import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  apiKeyLabelDetails,
  apiKeyLabelParts,
} from "@/domains/api-key/lib/api-key-label";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { EmptyValue } from "@/foundation/type/EmptyValue";

const INTERACTIVE = 'button, a, [role="option"], [role="combobox"]';

/**
 * One clipped line. Its tooltip carries the full text when the line is cut
 * off, or always when `alwaysTip` says the tooltip holds more than the line
 * shows. Without `tip`, the tooltip repeats the line's own text.
 */
function ClippedLine({
  tip,
  alwaysTip = false,
  className,
  children,
}: {
  tip?: ReactNode;
  alwaysTip?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tipped = useIsTruncated(ref) || alwaysTip;
  // Inside a button, link or select the control itself takes focus; a second
  // stop inside it would nest one interactive element in another.
  const [nested, setNested] = useState(false);
  useLayoutEffect(() => {
    setNested(Boolean(ref.current?.parentElement?.closest(INTERACTIVE)));
  }, []);
  const focusable = tipped && !nested;
  const line = (
    <div
      ref={ref}
      tabIndex={focusable ? 0 : undefined}
      className={cn(
        "truncate",
        focusable &&
          "focus-visible:outline-none focus-visible:[box-shadow:var(--nt-outline-active-focus)]",
        className,
      )}
    >
      {children}
    </div>
  );
  if (!tipped) return line;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{line}</TooltipTrigger>
      <TooltipContent className="max-w-md break-all">
        {tip ?? children}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * An API key's name, with its technical name and description.
 *
 * `stacked` is the name with the technical name and description under it, for
 * a list row or table cell. `inline` is the name alone on one line, for a
 * control one line tall (a select trigger), with the rest on its tooltip.
 */
export function ApiKeyLabel({
  name,
  displayName,
  description,
  variant = "stacked",
  className,
}: {
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
  variant?: "stacked" | "inline";
  className?: string;
}) {
  const { t } = useTranslation();
  const label = apiKeyLabelParts({ name, displayName, description });
  const primary = label.primary || <EmptyValue />;

  if (variant === "inline") {
    const lines = apiKeyLabelDetails(label, t("api_keys.label.technicalName"));
    return (
      <TooltipProvider delayDuration={200}>
        <ClippedLine
          alwaysTip={lines.length > 1}
          tip={<div className="whitespace-pre-line">{lines.join("\n")}</div>}
          className={cn("min-w-0 text-sm", className)}
        >
          {primary}
        </ClippedLine>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("min-w-0 text-left", className)}>
        <ClippedLine className="text-sm">{primary}</ClippedLine>
        {label.technicalName ? (
          <ClippedLine className="font-mono text-[10px] font-normal leading-4 text-muted-foreground/70">
            {label.technicalName}
          </ClippedLine>
        ) : null}
        {label.description ? (
          // The leading is explicit: at 10px the line otherwise inherits the
          // name's 20px line box, which reads as a gap between the two lines and
          // pushes the block out of any control sized for one line.
          <ClippedLine className="text-[10px] font-normal leading-4 text-muted-foreground/70">
            {label.description}
          </ClippedLine>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
