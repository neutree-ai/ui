type TruncatedText = {
  /** What to render. Equal to the input when it fits. */
  text: string;
  truncated: boolean;
};

/**
 * Shortens a value by dropping its middle, keeping the two ends visible.
 *
 * End-truncation (`text-overflow: ellipsis`) hides the tail, and the tail is
 * what distinguishes one machine value from another: two mount paths differ by
 * `…/registry/prod` against `…/registry/staging`, and two image references by
 * their tag. `BreakableReference` already refuses to truncate for that reason;
 * where a single line is a hard requirement, dropping the middle is the
 * compromise that keeps both the scheme (what kind of address this is) and the
 * last segment (which one it is) readable.
 *
 * Three rules keep the result predictable:
 * - the scheme is never cut, so `nfs://` still reads as a mount;
 * - the cut happens at a `/`, so a host or directory name is not sliced in half
 *   when a boundary is available;
 * - the result is never longer than `max`; the ellipsis counts as one
 *   character.
 *
 * A value that already fits is returned untouched — callers show the full text
 * and skip whatever recovery affordance they offer for the shortened case.
 */
export function middleTruncate(value: string, max: number): TruncatedText {
  if (max <= 0 || value.length <= max) {
    return { text: value, truncated: false };
  }

  const budget = max - 1;
  const schemeEnd = value.indexOf("://");
  const minHead = schemeEnd >= 0 ? schemeEnd + 3 : 0;

  let head = Math.min(Math.max(Math.ceil(budget / 2), minHead), budget);
  const slashBefore = value.lastIndexOf("/", head);
  if (slashBefore >= minHead && slashBefore + 1 <= budget) {
    head = slashBefore + 1;
  }

  let tailStart = value.length - (budget - head);
  const slashAfter = value.indexOf("/", tailStart);
  if (slashAfter !== -1 && slashAfter + 1 < value.length) {
    tailStart = slashAfter + 1;
  }

  return {
    text: `${value.slice(0, head)}…${value.slice(tailStart)}`,
    truncated: true,
  };
}
