import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback } from "react";
import { decideFormEnterSubmit } from "@/foundation/lib/enter-submit";

/**
 * Keeps Enter inside a complex form from submitting: submission must come from
 * the submit button — Tab to it and press Enter, or click it (SG-R-00009).
 *
 * Attach the returned handler to the `<form>`'s `onKeyDown`.
 */
export const useFormEnterSubmitGuard = () => {
  return useCallback((event: ReactKeyboardEvent<HTMLFormElement>) => {
    const decision = decideFormEnterSubmit(
      {
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        target: event.target,
        isComposing: event.nativeEvent.isComposing,
        keyCode: event.nativeEvent.keyCode,
      },
      event.currentTarget,
    );

    if (decision === "allow") {
      return;
    }

    if (decision === "block") {
      event.preventDefault();
      return;
    }

    // The keystroke itself is left to the IME — canceling it would drop the
    // candidate the user just accepted. If that same Enter still turns into a
    // submit event, refuse that instead.
    cancelSubmitOnce(event.currentTarget);
  }, []);
};

/**
 * Refuses the next submit event on this form, then disarms. The submit of an
 * implicit submission is dispatched synchronously with the keystroke, so the
 * listener is registered before it can bubble to React's root handler.
 */
function cancelSubmitOnce(form: HTMLFormElement) {
  let timer = 0;
  const disarm = () => {
    window.clearTimeout(timer);
    form.removeEventListener("submit", cancel, true);
  };
  const cancel = (submitEvent: Event) => {
    submitEvent.preventDefault();
    submitEvent.stopPropagation();
    disarm();
  };

  timer = window.setTimeout(disarm, 0);
  form.addEventListener("submit", cancel, true);
}
