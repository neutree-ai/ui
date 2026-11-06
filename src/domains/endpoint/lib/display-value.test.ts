import { expect, it } from "vitest";
import { formatDisplayValue } from "./display-value";

const circular: Record<string, unknown> = {};
circular.self = circular;

it.each([
  { value: undefined, text: "" },
  { value: null, text: "" },
  { value: true, text: "true" },
  { value: 8, text: "8" },
  { value: { nested: true }, text: '{"nested":true}' },
  { value: circular, text: "[object Object]" },
])("formats $value as '$text'", ({ value, text }) => {
  expect(formatDisplayValue(value)).toBe(text);
});
