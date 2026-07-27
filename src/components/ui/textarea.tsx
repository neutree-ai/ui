import * as React from "react";

import { cn } from "@/foundation/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-[var(--nt-radius-input)] border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-white)] px-3 py-2 text-sm text-[var(--nt-text-neutral-primary)] shadow-[var(--nt-effect-button-shadow-push-button-ordinary)] [transition:border-color_var(--nt-motion-fast),box-shadow_var(--nt-motion-fast)] placeholder:text-[var(--nt-text-neutral-quaternary)] hover:border-[var(--nt-stroke-neutral-trans-4)] focus-visible:border-[var(--nt-stroke-outstanding-base)] focus-visible:outline-none focus-visible:shadow-[var(--nt-outline-active-focus)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
