import type { PropsWithChildren } from "react";
import { cn } from "@/foundation/lib/utils";

type FormSectionStackProps = {
  className?: string;
} & PropsWithChildren<unknown>;

export function FormSectionStack({
  children,
  className,
}: FormSectionStackProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)]",
        "divide-y divide-[var(--nt-stroke-neutral-trans-2)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
