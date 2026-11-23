import { Fragment } from "react";
import { cn } from "@/foundation/lib/utils";

/**
 * Splits a reference after each `/` and before each `:`, which is where a
 * reader's eye already separates it.
 *
 * Exported for its test: the segmentation is the whole behaviour, and the
 * `<wbr>` elements it produces are the only part of this a test can see.
 */
export function referenceSegments(value: string): string[] {
  // Keep the separator with the segment it closes, so a break never orphans a
  // slash at the start of a line.
  return value.split(/(?<=\/)|(?=:)/).filter(Boolean);
}

/**
 * A long image reference, wrapped where it reads.
 *
 * `host/project/namespace/repository:tag` runs to sixty characters and offers a
 * browser no break opportunity at all — no spaces, and `/` and `:` are not
 * break points by default. Left alone in a flex row it refuses to shrink,
 * pushes its siblings to nothing and overflows whatever contains it.
 *
 * Breaking rather than truncating, because the tail is the part that
 * distinguishes one candidate from another: two images in a list differ by
 * `:v0.1.2` against `:v0.1.3`, and clipping the end hides exactly what the
 * reader is choosing between. `overflow-wrap: anywhere` is the backstop for a
 * single segment longer than the line; the `<wbr>` hints are preferred over it.
 */
export function BreakableReference({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span className={cn("[overflow-wrap:anywhere]", className)}>
      {referenceSegments(value).map((segment, index) => (
        // Segments are positional, so the index is the identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
        <Fragment key={index}>
          {segment}
          <wbr />
        </Fragment>
      ))}
    </span>
  );
}
