import { fireEvent, screen, within } from "@testing-library/react";

/**
 * Picks an option from the Radix Select rendered inside a form field
 * (`data-testid="field-<name>"`). Targets the button trigger, not the hidden
 * native select Radix also renders.
 */
export function selectOption(fieldName: string, option: string | RegExp) {
  const field = screen.getByTestId(`field-${fieldName}`);
  const trigger = field.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error(`no select trigger in field-${fieldName}`);
  pickOption(trigger, option);
}

/**
 * Picks an option from the Radix Select opened by `trigger`. For a select
 * found by its label rather than a `field-<name>` wrapper. Only the open
 * select renders its options, so the option query cannot hit another one.
 */
export function pickOption(trigger: Element, option: string | RegExp) {
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: option }));
}

/** Types into the input rendered inside a form field. */
export function fillField(fieldName: string, value: string | number) {
  const field = screen.getByTestId(`field-${fieldName}`);
  const input =
    within(field).queryByRole("textbox") ??
    within(field).queryByRole("spinbutton") ??
    field.querySelector("input, textarea");
  if (!input) throw new Error(`no input in field-${fieldName}`);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

/**
 * Whether an element is hidden from the user. jsdom applies no stylesheet,
 * so Tailwind's `hidden` class counts alongside the `hidden` attribute.
 */
export function isHidden(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.classList.contains("hidden")) {
      return true;
    }
  }
  return false;
}

/**
 * Opens a Radix DropdownMenu or Select. Both open on pointer down, not click:
 * a plain click leaves them closed and later assertions pass vacuously.
 */
export function openMenu(trigger: Element) {
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
}
