import { CircleHelp } from "lucide-react";
import type { ComponentPropsWithoutRef, FocusEvent } from "react";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/foundation/lib/utils";

// Radix opens a tooltip on any focus, so a dialog that auto-focuses this
// button on open would show the tooltip. Only keyboard focus should; where
// `:focus-visible` is unsupported, keep Radix's default.
const ignoreProgrammaticFocus = (event: FocusEvent<HTMLButtonElement>) => {
  try {
    if (!event.currentTarget.matches(":focus-visible")) event.preventDefault();
  } catch {}
};

// A `?`-in-a-circle button that reveals `label` on hover or focus — the
// explanation for a section title that would otherwise crowd the title
// itself. Self-contained (owns its own TooltipProvider) so a caller never
// has to wrap it, the same way SegmentedControl owns its own.
export const InfoHint = ({
  label,
  tabIndex,
}: {
  label: string;
  /** -1 where the text is exposed elsewhere, e.g. as a dialog's description. */
  tabIndex?: number;
}) => (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild onFocus={ignoreProgrammaticFocus}>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={label}
          tabIndex={tabIndex}
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-xs leading-5">
        {label}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

/** A form label with its explanation behind a `?` beside it. */
export const LabelWithHint = ({
  hint,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Label> & { hint: string }) => (
  <div className={cn("flex items-center gap-1", className)}>
    <Label {...props} />
    <InfoHint label={hint} />
  </div>
);
