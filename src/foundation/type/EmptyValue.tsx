import { cn } from "@/foundation/lib/utils";

/**
 * The character for a value a resource does not have. Exported on its own for
 * the places that build a string rather than an element — a translated message,
 * a table sort key, a form value — so those stay on the same character.
 */
export const EMPTY_VALUE = "-";

/**
 * The product's placeholder for a value a resource does not have.
 *
 * It reads as an absence, not as content, so it takes the same colour as an
 * input placeholder (`--nt-text-neutral-quaternary`) rather than the darker
 * muted-foreground that real secondary text uses. Keeping the one
 * implementation here is what stops the character and the colour from drifting
 * apart again between pages.
 */
export function EmptyValue({ className }: { className?: string }) {
  return (
    <span
      data-testid="empty-value"
      className={cn("text-[var(--nt-text-neutral-quaternary)]", className)}
    >
      {EMPTY_VALUE}
    </span>
  );
}
