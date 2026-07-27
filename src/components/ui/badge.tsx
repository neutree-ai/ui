import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/foundation/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-4 focus:ring-ring/15",
  {
    variants: {
      variant: {
        default:
          "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15",
        secondary:
          "border-border bg-muted text-secondary-foreground hover:bg-muted/80",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
        outline: "border-border bg-card text-secondary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

// forwardRef so the Badge can be used as a Radix `asChild` trigger (Tooltip /
// Popover / DropdownMenu). Without it, Slot can't attach the trigger ref, so
// the tooltip has no anchor and never opens — only the cursor-help style leaks
// through (the access-log status badge symptom).
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
