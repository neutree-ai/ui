import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/foundation/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-[var(--nt-radius-checkbox)] border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-white)] shadow-[var(--nt-effect-button-shadow-push-button-ordinary)] transition-colors hover:border-[var(--nt-stroke-neutral-trans-4)] focus-visible:outline-none focus-visible:shadow-[var(--nt-outline-active-focus)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--nt-fill-outstanding-base)] data-[state=checked]:bg-[var(--nt-fill-outstanding-base)] data-[state=checked]:text-[var(--nt-text-neutral-ontint)] data-[state=indeterminate]:border-[var(--nt-fill-outstanding-base)] data-[state=indeterminate]:bg-[var(--nt-fill-outstanding-base)] data-[state=indeterminate]:text-[var(--nt-text-neutral-ontint)]",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
