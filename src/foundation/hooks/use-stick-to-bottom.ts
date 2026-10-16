import { useCallback, useEffect, useRef, useState } from "react";
import { isScrolledToBottom } from "@/foundation/lib/stick-to-bottom";

type ScrollToBottomBehavior = "auto" | "smooth";

/**
 * Written as statements rather than one `&&` chain: every line here is a
 * decision the hook makes, and each is expected to be exercised — in a
 * document without `matchMedia`, and in one that answers either way.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Keeps a scroll container at its end while content grows, unless the reader
 * has scrolled away from it.
 *
 * A conversation is read at the bottom: new turns and streamed tokens are what
 * the reader is waiting for, so the view follows them. Reading history is the
 * opposite intent, and the two cannot both be honoured by scrolling on every
 * change — the reader who scrolled up to re-read an answer must not be dragged
 * back down by the next token. So following is a state, not an action:
 *
 * - `isAtBottom` says whether the container is parked at its end;
 * - content *and* container resizes pin the view while that is true, which
 *   covers streamed text as well as markdown that settles later (code blocks,
 *   tables, images) and containers that resize under the reader (window,
 *   sidebar, mobile keyboard);
 * - a scroll that leaves the end stops the following; scrolling back to the end
 *   resumes it, and `scrollToBottom()` is the explicit way back.
 *
 * Attach `scrollRef` to the element that actually scrolls — for a Radix scroll
 * area that is its viewport, not its root — and `contentRef` to the element
 * that grows.
 */
export function useStickToBottom() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const followingRef = useRef(true);
  const programmaticRef = useRef(false);
  /**
   * Where the view was, and how big the container was, at the last scroll we
   * judged.
   *
   * The box is as load-bearing as the position: the reader can move the view,
   * but only the layout can resize the container, so a changed box tells the
   * two apart (see `handleScroll`).
   */
  const lastScrollRef = useRef({ top: 0, width: 0, height: 0 });
  const [isAtBottom, setIsAtBottom] = useState(true);

  const pin = useCallback((behavior: ScrollToBottomBehavior) => {
    const element = scrollRef.current;
    if (!element) return;

    const distanceFromEnd =
      element.scrollHeight - element.clientHeight - element.scrollTop;
    // Already there: scrolling would emit no event to reconcile, and leaving
    // the flag set would swallow the reader's next scroll.
    if (distanceFromEnd <= 0) return;

    programmaticRef.current = true;
    if (behavior === "smooth" && !prefersReducedMotion()) {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
      return;
    }
    element.scrollTop = element.scrollHeight;
    // Remember where we put it: the reader's next scroll has to be judged
    // against the position we caused, not the one before our jump — their
    // event can arrive before the browser delivers ours.
    lastScrollRef.current.top = element.scrollTop;
  }, []);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const atBottom = isScrolledToBottom(element);
    const previous = lastScrollRef.current;
    const movedUp = element.scrollTop < previous.top - 1;
    const resized =
      element.clientWidth !== previous.width ||
      element.clientHeight !== previous.height;
    lastScrollRef.current = {
      top: element.scrollTop,
      width: element.clientWidth,
      height: element.clientHeight,
    };

    if (programmaticRef.current) {
      // A smooth scroll reports every intermediate position, and those are not
      // the reader's doing. Ignore them until the travel ends at the bottom —
      // but if the position moves the other way, somebody took the scrollbar
      // mid-animation, and that intent wins.
      if (!atBottom && !movedUp) return;
      programmaticRef.current = false;
    }

    // A narrower window re-wraps the transcript and grows it, and the browser
    // answers with scroll anchoring: it parks the view at the paragraph it was
    // showing rather than leaving it at the end. That scroll arrives *before*
    // the ResizeObserver callback that would put the view back, so judging it
    // the way the reader's own scroll is judged stops the following for good —
    // the transcript is left in the middle of the conversation, with the
    // newest turn off screen and nothing coming to fetch it. The container's
    // box changing with the event is what marks the move as the layout's:
    // the reader cannot resize the container, and while following they are
    // already at the end, so there is nowhere further down for them to scroll.
    if (followingRef.current && !atBottom && resized) {
      pin("auto");
      return;
    }

    if (atBottom === followingRef.current) return;
    followingRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, [pin]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return;

    // A conversation opens at its latest turn, not its first.
    pin("auto");

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (followingRef.current) pin("auto");
    });
    observer.observe(contentElement);
    observer.observe(scrollElement);
    return () => observer.disconnect();
  }, [pin]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    lastScrollRef.current = {
      top: element.scrollTop,
      width: element.clientWidth,
      height: element.clientHeight,
    };
    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToBottom = useCallback(
    (behavior: ScrollToBottomBehavior = "auto") => {
      followingRef.current = true;
      setIsAtBottom(true);
      pin(behavior);
    },
    [pin],
  );

  return { scrollRef, contentRef, isAtBottom, scrollToBottom };
}
