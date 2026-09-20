/**
 * Where Enter is allowed to submit a form.
 *
 * A complex form (two or more setting options) does not submit on Enter from a
 * field: submission has to come from the submit button — Tab to it and press
 * Enter, or click it. Single-field forms keep native Enter-to-submit, and
 * widgets that own Enter (comboboxes, array entry editors, textareas) keep
 * their own behavior.
 */

/** Number of setting options from which a form counts as complex. */
export const COMPLEX_FORM_MIN_OPTIONS = 2;

/**
 * Marks one setting option inside a form. `FormFieldGroup` sets it for every
 * field it renders, so the count follows conditional rendering for free.
 */
const FORM_OPTION_ATTRIBUTE = "data-form-option";

const FORM_OPTION_SELECTOR = `[${FORM_OPTION_ATTRIBUTE}]`;
const ENTER_KEY = "Enter";
const IME_PROCESS_KEY_CODE = 229;

/**
 * Input types whose Enter activates the control itself rather than submitting:
 * the submit button is the explicit submit path the rule requires, and a file
 * input uses Enter to open the picker.
 */
const INPUT_TYPES_OWNING_ENTER = new Set([
  "submit",
  "image",
  "button",
  "reset",
  "file",
]);

/** What Enter on a field inside this form has to do. */
type EnterSubmitDecision = "allow" | "block" | "block-composition-submit";

type FormOptionCounter = {
  querySelectorAll: (selectors: string) => { length: number };
};

type EnterSubmitEvent = {
  key: string;
  defaultPrevented: boolean;
  target: EventTarget | null;
  isComposing?: boolean;
  keyCode?: number;
};

/** Setting options currently rendered inside the form. */
export function countFormOptions(form: FormOptionCounter): number {
  return form.querySelectorAll(FORM_OPTION_SELECTOR).length;
}

export function isComplexForm(form: FormOptionCounter): boolean {
  return countFormOptions(form) >= COMPLEX_FORM_MIN_OPTIONS;
}

/**
 * True while an input method is composing: that Enter belongs to the IME
 * (accepting a candidate), so the page must not cancel the keystroke. Browsers
 * do not run implicit submission for these, and the caller still cancels a
 * submit that follows one — see `decideFormEnterSubmit`.
 */
function isComposingEnter(
  event: Pick<EnterSubmitEvent, "isComposing" | "keyCode">,
): boolean {
  return event.isComposing === true || event.keyCode === IME_PROCESS_KEY_CODE;
}

/** A control the user types into or picks from, as opposed to a button. */
function isFieldControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLTextAreaElement) {
    // Enter inserts a newline; a textarea never submits on its own.
    return false;
  }
  if (target instanceof HTMLInputElement) {
    return !INPUT_TYPES_OWNING_ENTER.has(target.type);
  }
  return target instanceof HTMLSelectElement;
}

export function decideFormEnterSubmit(
  event: EnterSubmitEvent,
  form: FormOptionCounter,
): EnterSubmitDecision {
  if (event.key !== ENTER_KEY || event.defaultPrevented) {
    return "allow";
  }
  if (!isFieldControl(event.target)) {
    return "allow";
  }
  if (!isComplexForm(form)) {
    return "allow";
  }
  return isComposingEnter(event) ? "block-composition-submit" : "block";
}
