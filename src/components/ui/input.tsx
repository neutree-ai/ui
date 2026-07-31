import * as React from "react";

import { cn } from "@/foundation/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-[var(--nt-radius-input)] border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-white)] px-3 py-1 text-sm text-[var(--nt-text-neutral-primary)] shadow-[var(--nt-effect-button-shadow-push-button-ordinary)] [transition:border-color_var(--nt-motion-fast),box-shadow_var(--nt-motion-fast)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--nt-text-neutral-quaternary)] hover:border-[var(--nt-stroke-neutral-trans-4)] focus-visible:border-[var(--nt-stroke-outstanding-base)] focus-visible:outline-none focus-visible:[box-shadow:var(--nt-outline-active-focus)] disabled:cursor-not-allowed disabled:border-[var(--nt-stroke-neutral-trans-3)] disabled:bg-[var(--nt-fill-neutral-trans-3)] disabled:text-[var(--nt-text-neutral-tertiary)] disabled:shadow-none disabled:hover:border-[var(--nt-stroke-neutral-trans-3)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
