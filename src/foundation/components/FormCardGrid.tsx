import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/foundation/lib/utils";

type FormCardGridProps = {
  title?: ReactNode;
  testId?: string;
  className?: string;
  variant?: "card" | "section";
} & PropsWithChildren<unknown>;

export const FORM_GRID_GAP_CLASS = "gap-x-6 gap-y-4";

/** The four-column form grid, stacked to one column below `sm`. */
export const FORM_GRID_CLASS = `grid grid-cols-1 sm:grid-cols-4 ${FORM_GRID_GAP_CLASS}`;

export default function FormCardGrid({
  children,
  title,
  testId,
  className,
  variant = "card",
}: FormCardGridProps) {
  if (variant === "section") {
    return (
      <section data-testid={testId} className={className}>
        {title && (
          <div className="px-6 pt-5">
            <h2 className="text-base font-semibold leading-6 text-[var(--nt-text-neutral-super)]">
              {title}
            </h2>
          </div>
        )}
        <div className={cn(FORM_GRID_CLASS, "px-6 py-5")}>{children}</div>
      </section>
    );
  }

  return (
    <section
      data-testid={testId}
      className={cn(
        "rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] [box-shadow:var(--nt-effect-dashboard-card-shadow-normal)]",
        "first:mt-0",
        className,
      )}
    >
      {title && (
        <div className="border-b border-[var(--nt-stroke-neutral-trans-2)] px-5 py-3">
          <h2 className="text-base font-semibold leading-6 text-[var(--nt-text-neutral-super)]">
            {title}
          </h2>
        </div>
      )}
      <div className={cn(FORM_GRID_CLASS, "px-5 py-4")}>{children}</div>
    </section>
  );
}
