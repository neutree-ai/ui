import type { PropsWithChildren } from "react";
import { cn } from "@/foundation/lib/utils";

type FormCardGridProps = {
  title?: string;
  testId?: string;
  className?: string;
  variant?: "card" | "section";
} & PropsWithChildren<unknown>;

export default function FormCardGrid({
  children,
  title,
  testId,
  className,
  variant = "card",
}: FormCardGridProps) {
  if (variant === "section") {
    return (
      <section
        data-testid={testId}
        className={cn(
          "border-t border-[var(--nt-stroke-neutral-trans-2)] first:border-t-0",
          className,
        )}
      >
        {title && (
          <div className="px-6 pt-5">
            <h2 className="text-sm font-semibold leading-5 text-[var(--nt-text-neutral-super)]">
              {title}
            </h2>
          </div>
        )}
        <div className="grid grid-cols-4 gap-x-6 gap-y-4 px-6 py-5 xs:grid-cols-1">
          {children}
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid={testId}
      className={cn(
        "rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] shadow-[var(--nt-effect-dashboard-card-shadow-normal)]",
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
      <div className="grid grid-cols-4 gap-x-5 gap-y-4 px-5 py-4 xs:grid-cols-1">
        {children}
      </div>
    </section>
  );
}
