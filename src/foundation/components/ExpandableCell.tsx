import { Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/foundation/lib/utils";

/**
 * A table cell whose content is clipped, plus the control that opens the rest.
 *
 * The engine values-schema table and the endpoint engine-argument table show a
 * line or two per row and cut the remainder off; both carried their own copy of
 * this markup before. Measurement stays with the caller, because that is where
 * the clipped element lives — and a cell can clip in more than one place (a
 * description *and* a row of enum tags), which one ref cannot express.
 */
export function ExpandableCell({
  truncated,
  label,
  panel,
  children,
  contentClassName,
  panelClassName,
}: {
  /** True when the content is really cut off: the control means "there is more". */
  truncated: boolean;
  /** Accessible name of the control, already translated. */
  label: string;
  /** Panel body. It renders in a portal, so opening it never changes the row height. */
  panel: ReactNode;
  /** The clipped content. */
  children: ReactNode;
  contentClassName?: string;
  panelClassName?: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <div className={cn("min-w-0 flex-1", contentClassName)}>{children}</div>
      {truncated ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-[var(--nt-text-neutral-quaternary)] hover:text-[var(--nt-text-neutral-secondary)]"
              aria-label={label}
            >
              <Maximize2 className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className={cn("w-[420px]", panelClassName)}
          >
            {panel}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

/**
 * Shell for what the control opens: the field's machine name on its own line,
 * optional qualifiers beside it, then the body. Both tables read the same way
 * once expanded, whichever of the two a reader opened first.
 */
export function ExpandPanel({
  label,
  meta,
  children,
}: {
  /** Machine name of the field the panel belongs to. */
  label: string;
  /** Type, required state or similar, shown after the name. */
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs">{label}</span>
        {meta}
      </div>
      {children}
    </div>
  );
}
