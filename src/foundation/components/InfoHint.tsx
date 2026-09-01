import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// A `?`-in-a-circle button that reveals `label` on hover or focus — the
// explanation for a section title that would otherwise crowd the title
// itself. Self-contained (owns its own TooltipProvider) so a caller never
// has to wrap it, the same way SegmentedControl owns its own.
export const InfoHint = ({ label }: { label: string }) => (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={label}
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
