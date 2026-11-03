import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/foundation/lib/utils";

type DisclosureProps = {
  title: ReactNode;
  children: ReactNode;
  /** Optional one-line result shown next to the title. */
  summary?: ReactNode;
  /** Decorative content before the title, such as a numbered marker. */
  leading?: ReactNode;
  /** Independent actions shown beside, not inside, the toggle. */
  actions?: ReactNode;
  variant?: "card" | "plain";
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  testId?: string;
  dataState?: string;
  triggerTestId?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Shared disclosure surface for read-only summaries and optional settings.
 *
 * The whole header is the hit target. Card disclosures reserve a separate
 * content band; plain disclosures keep the trigger and content in one flow.
 */
export function Disclosure({
  title,
  children,
  summary,
  leading,
  actions,
  variant = "card",
  className,
  triggerClassName,
  contentClassName,
  testId,
  dataState,
  triggerTestId,
  defaultOpen,
  open,
  onOpenChange,
}: DisclosureProps) {
  const card = variant === "card";

  return (
    <Collapsible
      className={cn(
        card && "overflow-hidden rounded-md border bg-muted/10",
        className,
      )}
      data-testid={testId}
      data-state={dataState}
      data-variant={variant}
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className={cn("flex items-stretch", card ? "bg-transparent" : "")}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            data-testid={triggerTestId}
            className={cn(
              "group h-auto min-w-0 flex-1 justify-start gap-2 rounded-none text-left",
              card
                ? "px-4 py-3 hover:bg-[var(--nt-fill-neutral-opaque-1)]"
                : "px-0 py-1 hover:bg-transparent",
              triggerClassName,
            )}
          >
            {leading}
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-medium text-foreground">
                {title}
              </span>
              {summary && (
                <span className="mt-0.5 block whitespace-normal break-words text-xs font-normal text-muted-foreground">
                  {summary}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        {actions && (
          <div className="flex shrink-0 items-center pr-2">{actions}</div>
        )}
      </div>
      <CollapsibleContent
        className={cn(card && "border-t px-4 py-3", contentClassName)}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
