import { cn } from "@/foundation/lib/utils";

/**
 * The placeholder for a value the resource does not have.
 *
 * It reads as an absence, not as content, so it takes the same colour as an
 * input placeholder (`--nt-text-neutral-quaternary`) instead of the darker
 * muted-foreground used for real secondary text.
 */
export function EmptyValue({ className }: { className?: string }) {
  return (
    <span
      data-testid="empty-value"
      className={cn("text-[var(--nt-text-neutral-quaternary)]", className)}
    >
      -
    </span>
  );
}
