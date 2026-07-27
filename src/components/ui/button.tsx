import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/foundation/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--nt-radius-button)] text-sm font-medium [transition:background-color_var(--nt-motion-fast),border-color_var(--nt-motion-fast),color_var(--nt-motion-fast),box-shadow_var(--nt-motion-fast)] focus-visible:outline-none focus-visible:shadow-[var(--nt-outline-active-focus)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--nt-fill-outstanding-base)] text-[var(--nt-text-neutral-ontint)] shadow-[var(--nt-effect-button-shadow-push-button-cta)] hover:bg-[var(--nt-fill-outstanding-bright)] active:bg-[var(--nt-fill-outstanding-dark)]",
        destructive:
          "bg-[var(--nt-fill-serious-base)] text-[var(--nt-text-neutral-ontint)] shadow-[var(--nt-effect-button-shadow-push-button-cta)] hover:bg-[var(--nt-fill-serious-bright)] focus-visible:shadow-[var(--nt-outline-active-focus-error)]",
        outline:
          "border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-white)] text-[var(--nt-text-neutral-super)] shadow-[var(--nt-effect-button-shadow-push-button-ordinary)] hover:border-[var(--nt-stroke-neutral-trans-4)] hover:bg-[var(--nt-fill-neutral-opaque-1)]",
        secondary:
          "border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-super)] shadow-[var(--nt-effect-button-shadow-push-button-ordinary)] hover:bg-[var(--nt-fill-neutral-opaque-2)]",
        ghost:
          "text-[var(--nt-text-neutral-super)] hover:bg-[var(--nt-fill-neutral-trans-3)] hover:text-[var(--nt-text-neutral-super)]",
        link: "text-[var(--nt-text-colorful-outstanding)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1 text-sm",
        sm: "h-6 px-2 text-[13px] leading-5",
        lg: "h-10 px-4 text-base",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
