/**
 * How far from the bottom still counts as "at the bottom", in pixels.
 *
 * A conversation that is being read at the bottom is almost never scrolled to
 * the exact pixel: trackpads land on fractional offsets, a wheel notch can stop
 * a few pixels short, and markdown that re-wraps after a font settles moves the
 * target. Treating those as "the user scrolled away" would stop the view from
 * following, which is the behaviour this exists to provide — so the judgement
 * is deliberately a little loose.
 */
export const STICK_TO_BOTTOM_THRESHOLD_PX = 24;

type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

/**
 * Whether a scroll container is parked at its end.
 *
 * Content shorter than the container counts as being at the bottom: there is
 * nowhere to scroll, so the reader is already looking at the latest content, and
 * a view that has not started following yet (an empty conversation, a single
 * short exchange) should follow as soon as it grows.
 */
export function isScrolledToBottom(
  { scrollTop, scrollHeight, clientHeight }: ScrollMetrics,
  thresholdPx: number = STICK_TO_BOTTOM_THRESHOLD_PX,
): boolean {
  if (scrollHeight <= clientHeight) return true;
  return scrollHeight - clientHeight - scrollTop <= thresholdPx;
}
