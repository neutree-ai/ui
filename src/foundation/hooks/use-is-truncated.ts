import { type RefObject, useEffect, useState } from "react";

/**
 * Reports whether an element clips its own content, which is the condition
 * that requires a full-text Tooltip. Re-measures when the element resizes so a
 * narrower viewport turns the Tooltip on.
 *
 * Both axes count: a single-line chip clips horizontally, a line-clamped
 * description clips vertically.
 */
export function useIsTruncated(ref: RefObject<HTMLElement | null>): boolean {
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const measure = () => {
      setIsTruncated(
        element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1,
      );
    };
    measure();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isTruncated;
}
