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

  // Deliberately re-subscribed after every render, not once per ref. A caller
  // is allowed to move the element when the answer changes — wrapping a clipped
  // name in its tooltip, say — and that remounts it. An observer left on the
  // node that was replaced goes on reporting the size of a detached element
  // (0x0, which reads as "fits") and flips the answer straight back.
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
  });

  return isTruncated;
}
