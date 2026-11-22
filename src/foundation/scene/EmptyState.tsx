import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/foundation/lib/utils";

type EmptyStateVariant = "inline" | "section" | "page";

type EmptyStateProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    variant?: EmptyStateVariant;
  }
>;

const variantClassNames: Record<EmptyStateVariant, string> = {
  inline:
    "rounded-[var(--nt-radius-input)] bg-[var(--nt-fill-neutral-opaque-1)] px-3 py-2 text-center text-sm text-[var(--nt-text-neutral-tertiary)]",
  section:
    "rounded-[var(--nt-radius-card)] bg-[var(--nt-fill-neutral-opaque-1)] px-4 py-6 text-center text-sm text-[var(--nt-text-neutral-tertiary)]",
  page: "py-12 text-center text-sm text-[var(--nt-text-neutral-tertiary)]",
};

export function EmptyState({
  children,
  className,
  variant = "section",
  ...props
}: EmptyStateProps) {
  return (
    <div className={cn(variantClassNames[variant], className)} {...props}>
      {children}
    </div>
  );
}
