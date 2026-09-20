import { describe, expect, it } from "vitest";
import {
  COMPLEX_FORM_MIN_OPTIONS,
  countFormOptions,
  decideFormEnterSubmit,
  isComplexForm,
} from "./enter-submit";

function buildForm({
  options,
  field = '<input data-testid="field" />',
}: {
  options: number;
  field?: string;
}) {
  const form = document.createElement("form");
  form.innerHTML = `${'<div data-form-option=""></div>'.repeat(options)}${field}`;
  return form;
}

function buildEvent(
  target: EventTarget,
  overrides: Partial<Parameters<typeof decideFormEnterSubmit>[0]> = {},
) {
  return {
    key: "Enter",
    defaultPrevented: false,
    target,
    ...overrides,
  };
}

describe("form Enter submit rule", () => {
  it("counts the rendered setting options of a form", () => {
    expect(countFormOptions(buildForm({ options: 0 }))).toBe(0);
    expect(countFormOptions(buildForm({ options: 3 }))).toBe(3);
    expect(COMPLEX_FORM_MIN_OPTIONS).toBe(2);
    expect(isComplexForm(buildForm({ options: 1 }))).toBe(false);
    expect(isComplexForm(buildForm({ options: 2 }))).toBe(true);
  });

  it("blocks Enter from a field once the form has two options", () => {
    const form = buildForm({ options: 2 });

    expect(
      decideFormEnterSubmit(buildEvent(form.querySelector("input")!), form),
    ).toBe("block");
  });

  it("keeps native Enter-to-submit in a single-option form", () => {
    const form = buildForm({ options: 1 });

    expect(
      decideFormEnterSubmit(buildEvent(form.querySelector("input")!), form),
    ).toBe("allow");
  });

  it("lets the submit button take Enter", () => {
    const form = buildForm({
      options: 2,
      field: '<input type="submit" data-testid="submit" />',
    });

    expect(
      decideFormEnterSubmit(buildEvent(form.querySelector("input")!), form),
    ).toBe("allow");
  });

  it("leaves Enter in a textarea to the newline it inserts", () => {
    const form = buildForm({ options: 2, field: "<textarea></textarea>" });

    expect(
      decideFormEnterSubmit(buildEvent(form.querySelector("textarea")!), form),
    ).toBe("allow");
  });

  it("blocks Enter in a select, which is a setting option too", () => {
    const form = buildForm({ options: 2, field: "<select></select>" });

    expect(
      decideFormEnterSubmit(buildEvent(form.querySelector("select")!), form),
    ).toBe("block");
  });

  it("ignores an event that did not come from an element", () => {
    const form = buildForm({ options: 2 });

    expect(decideFormEnterSubmit(buildEvent(new EventTarget()), form)).toBe(
      "allow",
    );
  });

  it("keeps the behavior of a widget that already claimed Enter", () => {
    const form = buildForm({ options: 2 });

    expect(
      decideFormEnterSubmit(
        buildEvent(form.querySelector("input")!, { defaultPrevented: true }),
        form,
      ),
    ).toBe("allow");
  });

  it("ignores keys other than Enter", () => {
    const form = buildForm({ options: 2 });

    expect(
      decideFormEnterSubmit(
        buildEvent(form.querySelector("input")!, { key: "a" }),
        form,
      ),
    ).toBe("allow");
  });

  it("leaves a composing Enter to the input method and refuses its submit", () => {
    const form = buildForm({ options: 2 });
    const input = form.querySelector("input")!;

    expect(
      decideFormEnterSubmit(buildEvent(input, { isComposing: true }), form),
    ).toBe("block-composition-submit");
    expect(
      decideFormEnterSubmit(buildEvent(input, { keyCode: 229 }), form),
    ).toBe("block-composition-submit");
  });
});
