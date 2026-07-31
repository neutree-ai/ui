import { cva } from "class-variance-authority";

export const authStyles = {
  container:
    "min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--secondary))]",

  button: cva(
    "inline-flex items-center justify-center rounded-[var(--nt-radius-button)] text-sm font-medium [transition:background-color_var(--nt-motion-fast),border-color_var(--nt-motion-fast),color_var(--nt-motion-fast),box-shadow_var(--nt-motion-fast)] focus-visible:outline-none focus-visible:shadow-[var(--nt-outline-active-focus)] disabled:opacity-50 disabled:pointer-events-none",
    {
      variants: {
        variant: {
          default:
            "bg-[var(--nt-fill-outstanding-base)] text-[var(--nt-text-neutral-ontint)] shadow-[var(--nt-effect-button-shadow-push-button-cta)] hover:bg-[var(--nt-fill-outstanding-bright)] active:bg-[var(--nt-fill-outstanding-dark)]",
          outline:
            "border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-white)] text-[var(--nt-text-neutral-super)] shadow-[var(--nt-effect-button-shadow-push-button-ordinary)] hover:border-[var(--nt-stroke-neutral-trans-4)] hover:bg-[var(--nt-fill-neutral-opaque-1)]",
        },
        size: {
          default: "h-10 py-2 px-4",
          sm: "h-9 px-3",
          lg: "h-11 px-8",
        },
      },
      defaultVariants: {
        variant: "default",
        size: "default",
      },
    },
  ),

  input:
    "flex h-10 w-full rounded-[var(--nt-radius-input)] border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-white)] px-3 py-2 text-sm placeholder:text-[var(--nt-text-neutral-quaternary)] hover:border-[var(--nt-stroke-neutral-trans-4)] focus-visible:border-[var(--nt-stroke-outstanding-base)] focus-visible:outline-none focus-visible:shadow-[var(--nt-outline-active-focus)] disabled:cursor-not-allowed disabled:opacity-50",

  label:
    "text-sm font-medium text-[var(--nt-text-neutral-primary)] leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
};
